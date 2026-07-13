package panels

import (
	"encoding/json"
	"fmt"
	"strings"
)

// HostedDomain matches the Qadbak iOS HostedDomain JSON shape.
type HostedDomain struct {
	Name      string `json:"name"`
	Disabled  bool   `json:"disabled,omitempty"`
	Plan      string `json:"plan,omitempty"`
	User      string `json:"user,omitempty"`
	DiskUsed  string `json:"disk_used,omitempty"`
	DiskLimit string `json:"disk_limit,omitempty"`
}

type DnsRecord struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Value    string `json:"value"`
	TTL      string `json:"ttl,omitempty"`
	Priority string `json:"priority,omitempty"`
	ID       string `json:"id,omitempty"`
}

type MailUser struct {
	User  string `json:"user"`
	Email string `json:"email,omitempty"`
	Quota string `json:"quota,omitempty"`
}

type HostedDatabase struct {
	Name string `json:"name"`
	Type string `json:"type,omitempty"`
	User string `json:"user,omitempty"`
}

type MailAlias struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type SslCert struct {
	Domain  string `json:"domain"`
	Issuer  string `json:"issuer,omitempty"`
	Expires string `json:"expires,omitempty"`
	Status  string `json:"status,omitempty"`
}

func hestiaLinkedUser(cfg LinkConfig) string {
	if u := strings.TrimSpace(cfg.Secrets["username"]); u != "" {
		return u
	}
	return ""
}

func HestiaListDomains(cfg LinkConfig) ([]HostedDomain, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return nil, err
	}
	fallbackUser := hestiaLinkedUser(cfg)
	usersRaw, err := c.call("v-list-users", "json")
	if err != nil {
		// fallback: list domains for linked user only
		if fallbackUser == "" {
			return nil, err
		}
		return hestiaListDomainsForUser(c, fallbackUser)
	}
	var users map[string]json.RawMessage
	if json.Unmarshal(usersRaw, &users) != nil {
		if fallbackUser == "" {
			return nil, fmt.Errorf("hestia: could not parse user list")
		}
		return hestiaListDomainsForUser(c, fallbackUser)
	}
	var out []HostedDomain
	for unixUser := range users {
		domains, err := hestiaListDomainsForUser(c, unixUser)
		if err != nil {
			continue
		}
		out = append(out, domains...)
	}
	return out, nil
}

func hestiaListDomainsForUser(c *hestiaClient, unixUser string) ([]HostedDomain, error) {
	raw, err := c.call("v-list-web-domains", unixUser, "json")
	if err != nil {
		return nil, err
	}
	var domains map[string]map[string]string
	if err := json.Unmarshal(raw, &domains); err != nil {
		return nil, err
	}
	out := make([]HostedDomain, 0, len(domains))
	for name, info := range domains {
		suspended := strings.EqualFold(info["SUSPENDED"], "yes") || info["SUSPENDED"] == "1"
		out = append(out, HostedDomain{
			Name:      name,
			Disabled:  suspended,
			User:      unixUser,
			Plan:      info["PLAN"],
			DiskUsed:  info["U_DISK"],
			DiskLimit: info["DISK_QUOTA"],
		})
	}
	return out, nil
}

func HestiaDomainOwner(cfg LinkConfig, domain string) (string, error) {
	domains, err := HestiaListDomains(cfg)
	if err != nil {
		return "", err
	}
	for _, d := range domains {
	 if strings.EqualFold(d.Name, domain) {
			return d.User, nil
		}
	}
	return "", fmt.Errorf("domain not found: %s", domain)
}

func HestiaListDNS(cfg LinkConfig, domain string) ([]DnsRecord, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return nil, err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return nil, err
	}
	raw, err := c.call("v-list-dns-records", owner, domain, "json")
	if err != nil {
		return nil, err
	}
	var records map[string]map[string]string
	if err := json.Unmarshal(raw, &records); err != nil {
		return nil, err
	}
	out := make([]DnsRecord, 0, len(records))
	for id, rec := range records {
		out = append(out, DnsRecord{
			ID:       id,
			Name:     rec["RECORD"],
			Type:     rec["TYPE"],
			Value:    rec["VALUE"],
			TTL:      rec["TTL"],
			Priority: rec["PRIORITY"],
		})
	}
	return out, nil
}

func HestiaAddDNS(cfg LinkConfig, domain string, rec DnsRecord) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-add-dns-record", owner, domain, rec.Name, rec.Type, rec.Value, rec.Priority, rec.TTL)
	return err
}

func HestiaDeleteDNS(cfg LinkConfig, domain, recordID string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-delete-dns-record", owner, domain, recordID)
	return err
}

func HestiaListMail(cfg LinkConfig, domain string) ([]MailUser, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return nil, err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return nil, err
	}
	raw, err := c.call("v-list-mail-accounts", owner, domain, "json")
	if err != nil {
		return nil, err
	}
	var accounts map[string]map[string]string
	if err := json.Unmarshal(raw, &accounts); err != nil {
		return nil, err
	}
	out := make([]MailUser, 0, len(accounts))
	for acct, info := range accounts {
		out = append(out, MailUser{
			User:  acct,
			Email: acct + "@" + domain,
			Quota: info["QUOTA"],
		})
	}
	return out, nil
}

func HestiaAddMail(cfg LinkConfig, domain, user, password string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-add-mail-account", owner, domain, user, password)
	return err
}

func HestiaChangeMailPassword(cfg LinkConfig, domain, user, password string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-change-mail-account-password", owner, domain, user, password)
	return err
}

func HestiaChangeDatabasePassword(cfg LinkConfig, domain, dbName, password string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-change-database-password", owner, dbName, password)
	return err
}

func HestiaDeleteMail(cfg LinkConfig, domain, user string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-delete-mail-account", owner, domain, user)
	return err
}

func HestiaListDatabases(cfg LinkConfig, domain string) ([]HostedDatabase, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return nil, err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return nil, err
	}
	raw, err := c.call("v-list-databases", owner, "json")
	if err != nil {
		return nil, err
	}
	var dbs map[string]map[string]string
	if err := json.Unmarshal(raw, &dbs); err != nil {
		return nil, err
	}
	out := make([]HostedDatabase, 0)
	for name, info := range dbs {
		if web, ok := info["WEB"]; ok && web != "" && !strings.Contains(web, domain) {
			continue
		}
		out = append(out, HostedDatabase{
			Name: name,
			Type: info["TYPE"],
			User: info["DBUSER"],
		})
	}
	return out, nil
}

func HestiaAddDatabase(cfg LinkConfig, domain, name, dbUser, password string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-add-database", owner, name, dbUser, password, "mysql", owner)
	return err
}

func HestiaListAliases(cfg LinkConfig, domain string) ([]MailAlias, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return nil, err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return nil, err
	}
	raw, err := c.call("v-list-mail-forwards", owner, domain, "json")
	if err != nil {
		return nil, err
	}
	var forwards map[string]map[string]string
	if err := json.Unmarshal(raw, &forwards); err != nil {
		return nil, err
	}
	out := make([]MailAlias, 0, len(forwards))
	for from, info := range forwards {
		out = append(out, MailAlias{From: from, To: info["DEST"]})
	}
	return out, nil
}

func HestiaAddAlias(cfg LinkConfig, domain, from, to string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-add-mail-forward", owner, domain, from, to)
	return err
}

func HestiaDeleteAlias(cfg LinkConfig, domain, from string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-delete-mail-forward", owner, domain, from)
	return err
}

func HestiaListSSL(cfg LinkConfig, domain string) ([]SslCert, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return nil, err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return nil, err
	}
	raw, err := c.call("v-list-web-domain-ssl", owner, domain, "json")
	if err != nil {
		return nil, err
	}
	var info map[string]string
	if json.Unmarshal(raw, &info) != nil {
		return []SslCert{{Domain: domain, Status: "unknown"}}, nil
	}
	return []SslCert{{
		Domain:  domain,
		Issuer:  info["ISSUER"],
		Expires: info["NOT_AFTER"],
		Status:  info["STATUS"],
	}}, nil
}

func HestiaIssueSSL(cfg LinkConfig, domain string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-add-letsencrypt-domain", owner, domain)
	return err
}

func HestiaCreateDomain(cfg LinkConfig, unixUser, domain, ip string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	if ip == "" {
		ip = "127.0.0.1"
	}
	_, err = c.call("v-add-web-domain", unixUser, domain, ip)
	return err
}

func HestiaDeleteDomain(cfg LinkConfig, domain string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-delete-web-domain", owner, domain)
	return err
}

func HestiaSuspendDomain(cfg LinkConfig, domain string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-suspend-web-domain", owner, domain)
	return err
}

func HestiaUnsuspendDomain(cfg LinkConfig, domain string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-unsuspend-web-domain", owner, domain)
	return err
}
