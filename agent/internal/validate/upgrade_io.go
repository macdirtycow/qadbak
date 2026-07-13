package validate

import (
	"fmt"
	"os"
)

// UpgradeStagingBinary validates and stats the agent upgrade staging binary.
func UpgradeStagingBinary(path string) (string, error) {
	clean, err := UpgradeStagingPath(path)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(clean)
	if err != nil {
		return "", fmt.Errorf("staging binary missing")
	}
	if info.Size() < 1024 {
		return "", fmt.Errorf("staging binary too small")
	}
	return clean, nil
}
