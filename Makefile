VERSION := $(shell cat version.txt)

update-version:
	@echo "Updating version to $(VERSION)"
	@sed -i '' "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" manifest.json
	@echo "window.PRO_VERSION = '$(VERSION)';" > version.js
	@sed -i '' "s/const PRO_VERSION = '.*';/const PRO_VERSION = '$(VERSION)';/" background.js

.PHONY: update-version
