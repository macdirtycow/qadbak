package panels

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/macdirtycow/qadbak/agent/internal/validate"
)

type DomainRedirect struct {
	Path string `json:"path,omitempty"`
	Dest string `json:"dest,omitempty"`
	Type string `json:"type,omitempty"`
}

type CronJob struct {
	ID       string `json:"id"`
	Schedule string `json:"schedule"`
	Command  string `json:"command"`
	User     string `json:"user,omitempty"`
	Active   bool   `json:"active,omitempty"`
}

type FtpAccount struct {
	User  string `json:"user"`
	Dir   string `json:"dir,omitempty"`
	Quota string `json:"quota,omitempty"`
}

type ScheduledBackup struct {
	ID       string `json:"id"`
	Schedule string `json:"schedule,omitempty"`
	Dest     string `json:"dest,omitempty"`
	Enabled  string `json:"enabled,omitempty"`
}

type BackupsPayload struct {
	Scheduled []ScheduledBackup `json:"scheduled"`
	CanBackup bool              `json:"canBackup"`
	Native    bool              `json:"native"`
}

func hestiaWebDomainInfo(c *hestiaClient, owner, domain string) (map[string]string, error) {
	raw, err := c.call("v-list-web-domain", owner, domain, "json")
	if err != nil {
		return nil, err
	}
	var outer map[string]map[string]string
	if err := json.Unmarshal(raw, &outer); err != nil {
		return nil, err
	}
	info, ok := outer[domain]
	if !ok {
		for _, v := range outer {
			info = v
			ok = true
			break
		}
	}
	if !ok {
		return nil, fmt.Errorf("domain info not found: %s", domain)
	}
	return info, nil
}

func HestiaListRedirects(cfg LinkConfig, domain string) ([]DomainRedirect, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return nil, err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return nil, err
	}
	info, err := hestiaWebDomainInfo(c, owner, domain)
	if err != nil {
		return nil, err
	}
	target := strings.TrimSpace(info["REDIRECT"])
	if target == "" {
		return []DomainRedirect{}, nil
	}
	code := strings.TrimSpace(info["REDIRECT_CODE"])
	if code == "" {
		code = "301"
	}
	return []DomainRedirect{{
		Path: "/",
		Dest: target,
		Type: code,
	}}, nil
}

func HestiaAddRedirect(cfg LinkConfig, domain, path, dest, code string) error {
	path = strings.TrimSpace(path)
	if path != "" && path != "/" {
		return fmt.Errorf("linked Hestia panel supports whole-domain redirects only (path must be /)")
	}
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	if strings.TrimSpace(code) == "" {
		code = "301"
	}
	_, err = c.call("v-add-web-domain-redirect", owner, domain, dest, code)
	return err
}

func HestiaDeleteRedirect(cfg LinkConfig, domain string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-delete-web-domain-redirect", owner, domain)
	return err
}

func HestiaListCronJobs(cfg LinkConfig, domain string) ([]CronJob, bool, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return nil, false, err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return nil, false, err
	}
	raw, err := c.call("v-list-cron-jobs", owner, "json")
	if err != nil {
		return nil, false, err
	}
	var jobs map[string]map[string]string
	if err := json.Unmarshal(raw, &jobs); err != nil {
		return nil, false, err
	}
	out := make([]CronJob, 0, len(jobs))
	for id, job := range jobs {
		schedule := strings.Join([]string{
			job["MIN"], job["HOUR"], job["DAY"], job["MONTH"], job["WDAY"],
		}, " ")
		active := !strings.EqualFold(job["SUSPENDED"], "yes") && job["SUSPENDED"] != "1"
		out = append(out, CronJob{
			ID:       id,
			Schedule: strings.TrimSpace(schedule),
			Command:  job["CMD"],
			User:     owner,
			Active:   active,
		})
	}
	return out, true, nil
}

func HestiaAddCronJob(cfg LinkConfig, domain, schedule, command string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	parts := strings.Fields(strings.TrimSpace(schedule))
	if len(parts) < 5 {
		return fmt.Errorf("schedule must have 5 fields (min hour day month weekday)")
	}
	_, err = c.call("v-add-cron-job", owner, parts[0], parts[1], parts[2], parts[3], parts[4], command)
	return err
}

func HestiaDeleteCronJob(cfg LinkConfig, domain, jobID string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-delete-cron-job", owner, jobID)
	return err
}

func HestiaListFtpAccounts(cfg LinkConfig, domain string) ([]FtpAccount, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return nil, err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return nil, err
	}
	info, err := hestiaWebDomainInfo(c, owner, domain)
	if err != nil {
		return nil, err
	}
	users := strings.Split(strings.TrimSpace(info["FTP_USER"]), ":")
	paths := strings.Split(strings.TrimSpace(info["FTP_PATH"]), ":")
	out := make([]FtpAccount, 0)
	for i, user := range users {
		user = strings.TrimSpace(user)
		if user == "" {
			continue
		}
		dir := ""
		if i < len(paths) {
			dir = strings.TrimSpace(paths[i])
		}
		out = append(out, FtpAccount{User: user, Dir: dir})
	}
	return out, nil
}

func HestiaAddFtpAccount(cfg LinkConfig, domain, ftpUser, password string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-add-web-domain-ftp", owner, domain, ftpUser, password)
	return err
}

func HestiaChangeFtpPassword(cfg LinkConfig, domain, ftpUser, password string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-change-web-domain-ftp-password", owner, domain, ftpUser, password)
	return err
}

func HestiaDeleteFtpAccount(cfg LinkConfig, domain, ftpUser string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-delete-web-domain-ftp", owner, domain, ftpUser)
	return err
}

func HestiaListBackups(cfg LinkConfig, domain string) (BackupsPayload, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return BackupsPayload{}, err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return BackupsPayload{}, err
	}
	raw, err := c.call("v-list-user-backups", owner, "json")
	if err != nil {
		return BackupsPayload{Scheduled: []ScheduledBackup{}, CanBackup: true, Native: true}, nil
	}
	var backups map[string]map[string]string
	if err := json.Unmarshal(raw, &backups); err != nil {
		return BackupsPayload{}, err
	}
	out := make([]ScheduledBackup, 0, len(backups))
	for name, info := range backups {
		if !backupIncludesDomain(info, domain) {
			continue
		}
		fileName := name
		if !strings.HasSuffix(fileName, ".tar") && !strings.HasSuffix(fileName, ".tar.gz") {
			fileName = name + ".tar"
		}
		out = append(out, ScheduledBackup{
			ID:       fileName,
			Schedule: info["TYPE"],
			Dest:     strings.TrimSpace(info["DATE"] + " · " + info["SIZE"]),
			Enabled:  "yes",
		})
	}
	return BackupsPayload{
		Scheduled: out,
		CanBackup: true,
		Native:    true,
	}, nil
}

func backupIncludesDomain(info map[string]string, domain string) bool {
	web := strings.TrimSpace(info["WEB"])
	if web == "" || web == "no" {
		return true
	}
	for _, part := range strings.FieldsFunc(web, func(r rune) bool {
		return r == ',' || r == ' ' || r == ';'
	}) {
		if strings.EqualFold(strings.TrimSpace(part), domain) {
			return true
		}
	}
	return strings.Contains(strings.ToLower(web), strings.ToLower(domain))
}

func HestiaStartBackup(cfg LinkConfig, domain string) (string, error) {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return "", err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return "", err
	}
	before, _ := HestiaListBackups(cfg, domain)
	beforeIDs := map[string]struct{}{}
	for _, b := range before.Scheduled {
		beforeIDs[b.ID] = struct{}{}
	}
	if _, err := c.call("v-backup-user", owner); err != nil {
		return "", err
	}
	after, err := HestiaListBackups(cfg, domain)
	if err != nil {
		return "", nil
	}
	for _, b := range after.Scheduled {
		if _, ok := beforeIDs[b.ID]; !ok {
			return b.ID, nil
		}
	}
	if len(after.Scheduled) > 0 {
		return after.Scheduled[0].ID, nil
	}
	return "", nil
}

func HestiaDeleteDatabase(cfg LinkConfig, domain, dbName string) error {
	c, err := newHestiaClient(cfg)
	if err != nil {
		return err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return err
	}
	_, err = c.call("v-delete-database", owner, dbName)
	return err
}

func HestiaResolveBackup(cfg LinkConfig, domain, name string) (string, error) {
	if !validate.BackupFilename(name) {
		return "", fmt.Errorf("invalid backup name")
	}
	c, err := newHestiaClient(cfg)
	if err != nil {
		return "", err
	}
	owner, err := HestiaDomainOwner(cfg, domain)
	if err != nil {
		return "", err
	}
	raw, err := c.call("v-list-user-backups", owner, "json")
	if err != nil {
		return "", err
	}
	var backups map[string]map[string]string
	if err := json.Unmarshal(raw, &backups); err != nil {
		return "", err
	}
	base := filepath.Base(name)
	found := false
	for key := range backups {
		if key == base || key == strings.TrimSuffix(base, ".tar") || key+".tar" == base {
			found = true
			break
		}
	}
	if !found {
		return "", fmt.Errorf("backup not found: %s", base)
	}
	return filepath.Join("/backup", base), nil
}
