package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"time"

	"github.com/raintreeinc/livepkg"

	"github.com/raintreeinc/knowledgebase/auth"
	"github.com/raintreeinc/knowledgebase/kb"
	"github.com/raintreeinc/knowledgebase/kb/pgdb"

	"github.com/raintreeinc/knowledgebase/module/admin"
	"github.com/raintreeinc/knowledgebase/module/dispatch"
	"github.com/raintreeinc/knowledgebase/module/dita"
	"github.com/raintreeinc/knowledgebase/module/group"
	"github.com/raintreeinc/knowledgebase/module/page"
	"github.com/raintreeinc/knowledgebase/module/search"
	"github.com/raintreeinc/knowledgebase/module/tag"
	"github.com/raintreeinc/knowledgebase/module/user"

	_ "github.com/lib/pq"
)

// TODO: add
//  https://github.com/unrolled/secure
//  https://github.com/justinas/nosurf

var (
	addr     = flag.String("listen", ":80", "http server `address`")
	database = flag.String("database", "user=root dbname=knowledgebase sslmode=disable", "database `params`")
	domain   = flag.String("domain", "", "`domain`")

	redirecthttps = flag.Bool("redirecthttps", false, "redirect http to https")

	development = flag.Bool("development", true, "development mode")
	ditamap     = flag.String("dita", "", "ditamap file for showing live dita")

	rules = flag.String("rules", "rules.json", "different rules for server")

	clientdir = flag.String("client", "client", "client `directory`")
)

func main() {
	flag.Parse()

	host, port := os.Getenv("HOST"), os.Getenv("PORT")
	if host != "" || port != "" {
		*addr = host + ":" + port
	}

	if os.Getenv("CLIENTDIR") != "" {
		*clientdir = os.Getenv("CLIENTDIR")
	}
	if rds := RDS(); rds != "" {
		*database = rds
	}
	if os.Getenv("DATABASE") != "" {
		*database = os.Getenv("DATABASE")
	}
	if os.Getenv("DOMAIN") != "" {
		*domain = os.Getenv("DOMAIN")
	}
	if os.Getenv("DITAMAP") != "" {
		*ditamap = os.Getenv("DITAMAP")
	}
	if os.Getenv("RULES") != "" {
		*rules = os.Getenv("RULES")
	}

	if os.Getenv("DEVELOPMENT") != "" {
		v, err := strconv.ParseBool(os.Getenv("DEVELOPMENT"))
		if err == nil {
			*development = v
		}
	}

	if os.Getenv("REDIRECTHTTPS") != "" {
		v, err := strconv.ParseBool(os.Getenv("REDIRECTHTTPS"))
		if err == nil {
			*redirecthttps = v
		}
	}

	log.Printf("Development %v\n", *development)
	log.Printf("Starting with database %s\n", *database)
	log.Printf("Starting %s on %s\n", *domain, *addr)

	// Serve static files
	http.Handle("/assets/", http.StripPrefix("/assets/",
		http.FileServer(http.Dir(filepath.Join(*clientdir, "assets")))))

	// Serve client
	client := livepkg.NewServer(http.Dir(*clientdir), *development, "/kb/app.js")
	http.Handle("/kb/", client)

	// Load database
	db, err := pgdb.New(*database)
	if err != nil {
		log.Fatal(err)
	}

	log.Println("Initializing DB")
	if err := db.Initialize(); err != nil {
		log.Fatal(err)
	}
	log.Println("DB Initialization complete.")

	// protect server with authentication
	url := "http://" + *domain
	auth.Register(os.Getenv("APPKEY"), url, "/system/auth", auth.ClientsFromEnv())

	sec := auth.New()
	sec.Alternate["guest"] = auth.NewDB(db)
	if caskey := os.Getenv("CASKEY"); caskey != "" {
		data, err := base64.StdEncoding.DecodeString(caskey)
		if err != nil {
			log.Fatal(err)
		}
		sec.Alternate["community"] = auth.NewCAS("community", data)
	}

	// create server
	server := kb.NewServer(kb.ServerInfo{
		Domain:     *domain,
		ShortTitle: "KB",
		Title:      "Knowledge Base",
		Company:    "Raintree Systems Inc.",

		TrackingID: os.Getenv("TRACKING_ID"),
		Version:    time.Now().Format("20060102150405"),
	}, sec, db)

	server.TemplatesDir = filepath.Join(*clientdir, "templates")

	ruleset := MustLoadRules(*rules)
	server.Rules = ruleset

	// add systems
	server.AddModule(admin.New(server))
	server.AddModule(group.New(server))
	server.AddModule(page.New(server))
	server.AddModule(search.New(server))
	server.AddModule(tag.New(server))
	server.AddModule(user.New(server))
	server.AddModule(dispatch.New(kb.Group{
		ID:          "help",
		Name:        "Help",
		Public:      false,
		Description: "Raintree Official Help",
	}, server))

	if *ditamap != "" {
		server.AddModule(dita.New("DITA", *ditamap, server))
	}

	http.HandleFunc("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(*clientdir, "assets", "ico", "favicon.ico"))
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		ishttps := r.Header.Get("X-Forwarded-Proto") == "https" || r.URL.Scheme == "https"
		if *redirecthttps && !ishttps {
			r.URL.Scheme = "https"
			r.URL.Host = *domain
			http.Redirect(w, r, r.URL.String(), http.StatusMovedPermanently)
			return
		}
		server.ServeHTTP(w, r)
	})
	log.Fatal(http.ListenAndServe(*addr, nil))
}

type RuleSet struct {
	Admins         []kb.Slug
	ByEmail        map[string][]kb.Slug `json:"byEmail"`
	ByAuthProvider map[string][]kb.Slug `json:"byAuthProvider"`
}

func (rs *RuleSet) Login(user kb.User, db kb.Database) error {
	context := db.Context("admin")
	_, err := context.Users().ByID(user.ID)
	created := err == nil

	createUserIfNeeded := func() {
		if !created {
			err := context.Users().Create(user)
			if err != nil {
				log.Println(err)
				return
			}
			created = true
		}
	}

	for rule, groups := range rs.ByEmail {
		matched, err := regexp.MatchString(rule, user.Email)
		if err != nil {
			log.Println(err)
		}
		if matched && err == nil {
			createUserIfNeeded()
			for _, group := range groups {
				context.Access().AddUser(group, user.ID)
			}
		}
	}

	for prov, groups := range rs.ByAuthProvider {
		if prov == user.AuthProvider {
			createUserIfNeeded()
			for _, group := range groups {
				context.Access().AddUser(group, user.ID)
			}
		}
	}

	for _, admin := range rs.Admins {
		if user.ID == admin {
			context.Access().SetAdmin(user.ID, true)
		}
	}

	err = context.Access().VerifyUser(user)
	if err != nil {
		log.Printf("Failed to login: %v\n", user)
	}
	return err
}

func MustLoadRules(filename string) *RuleSet {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		log.Fatal(err)
	}

	rs := &RuleSet{}
	if err := json.Unmarshal(data, rs); err != nil {
		log.Fatal(err)
	}

	return rs
}

func RDS() string {
	user := os.Getenv("RDS_USERNAME")
	pass := os.Getenv("RDS_PASSWORD")

	dbname := os.Getenv("RDS_DB_NAME")
	host := os.Getenv("RDS_HOSTNAME")
	port := os.Getenv("RDS_PORT")

	if user == "" || pass == "" || dbname == "" || host == "" || port == "" {
		return ""
	}

	return fmt.Sprintf("user='%s' password='%s' dbname='%s' host='%s' port='%s'", user, pass, dbname, host, port)
}
