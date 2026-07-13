package panels

import (
	"time"
)

type WidgetSummaryResult struct {
	DomainCount       int    `json:"domainCount"`
	WebsitesRunning   int    `json:"websitesRunning"`
	SSLExpiringSoon   int    `json:"sslExpiringSoon"`
	BackupStale       int    `json:"backupStale"`
	ContainersStopped int    `json:"containersStopped"`
	UrgentActions     int    `json:"urgentActions"`
	UpdatedAt         string `json:"updatedAt"`
}

func HestiaWidgetSummary(cfg LinkConfig) (WidgetSummaryResult, error) {
	domains, err := HestiaListDomains(cfg)
	if err != nil {
		return WidgetSummaryResult{}, err
	}
	running := 0
	sslSoon := 0
	backupStale := 0
	urgent := 0
	for _, d := range domains {
		if d.Disabled {
			urgent++
			continue
		}
		running++
		if days, err := hestiaSSLDaysLeft(cfg, d.Name); err == nil {
			if days >= 0 && days < 30 {
				sslSoon++
				urgent++
			}
		}
		payload, err := HestiaListBackups(cfg, d.Name)
		if err != nil || len(payload.Scheduled) == 0 {
			backupStale++
			urgent++
		}
	}
	return WidgetSummaryResult{
		DomainCount:       len(domains),
		WebsitesRunning:   running,
		SSLExpiringSoon:   sslSoon,
		BackupStale:       backupStale,
		ContainersStopped: 0,
		UrgentActions:     urgent,
		UpdatedAt:         time.Now().UTC().Format(time.RFC3339),
	}, nil
}
