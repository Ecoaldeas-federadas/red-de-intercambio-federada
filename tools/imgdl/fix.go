package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	userAgent   = "RedDeIntercambioFederada/1.0 (https://github.com/discapacidad5/red-de-intercambio-federada; educational project)"
	productsDir = "web/public/images/products"
	demoDir     = "web/public/images/demo"
)

type CommonsSearchResult struct {
	Query struct {
		Search []struct {
			Title  string `json:"title"`
			PageID int    `json:"pageid"`
		} `json:"search"`
	} `json:"query"`
}

type CommonsImageInfo struct {
	Query struct {
		Pages map[string]struct {
			Imageinfo []struct {
				ThumbURL string `json:"thumburl"`
				URL      string `json:"url"`
				Mime     string `json:"mime"`
			} `json:"imageinfo"`
		} `json:"pages"`
	} `json:"query"`
}

func httpGet(url string) ([]byte, error) {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", userAgent)
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func httpDownload(url string) ([]byte, int, error) {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", userAgent)
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return body, resp.StatusCode, nil
}

func searchCommons(keyword string, limit int) ([]string, error) {
	url := fmt.Sprintf(
		"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=%s&srnamespace=6&format=json&srlimit=%d",
		strings.ReplaceAll(keyword, " ", "+"), limit,
	)
	body, err := httpGet(url)
	if err != nil {
		return nil, err
	}
	var result CommonsSearchResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	var titles []string
	for _, s := range result.Query.Search {
		titles = append(titles, s.Title)
	}
	return titles, nil
}

func getCommonsImageURL(title string, width int) (string, string, error) {
	url := fmt.Sprintf(
		"https://commons.wikimedia.org/w/api.php?action=query&titles=%s&prop=imageinfo&iiprop=url|mime&iiurlwidth=%d&format=json",
		strings.ReplaceAll(title, " ", "+"), width,
	)
	body, err := httpGet(url)
	if err != nil {
		return "", "", err
	}
	var info CommonsImageInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return "", "", err
	}
	for _, page := range info.Query.Pages {
		if len(page.Imageinfo) > 0 {
			ii := page.Imageinfo[0]
			thumbURL := ii.ThumbURL
			if thumbURL == "" {
				thumbURL = ii.URL
			}
			return thumbURL, ii.Mime, nil
		}
	}
	return "", "", fmt.Errorf("no image info")
}

func isValidImage(body []byte) bool {
	if len(body) < 5000 {
		return false
	}
	if body[0] == 0xFF && body[1] == 0xD8 { return true }
	if body[0] == 0x89 && body[1] == 0x50 && body[2] == 0x4E && body[3] == 0x47 { return true }
	if body[0] == 0x47 && body[1] == 0x49 && body[2] == 0x46 { return true }
	return false
}

func saveImage(body []byte, dir, filename string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, filename), body, 0644)
}

func downloadFromCommons(searchTerm, filename, dir string, width int) bool {
	titles, err := searchCommons(searchTerm, 10)
	if err != nil {
		return false
	}
	for _, title := range titles {
		lower := strings.ToLower(title)
		if strings.Contains(lower, ".svg") || strings.Contains(lower, ".pdf") ||
			strings.Contains(lower, ".tif") || strings.Contains(lower, ".ogv") ||
			strings.Contains(lower, ".webm") || strings.Contains(lower, ".gif") ||
			strings.Contains(lower, ".webp") || strings.Contains(lower, ".ogg") ||
			strings.Contains(lower, ".mp3") || strings.Contains(lower, ".midi") ||
			strings.Contains(lower, "logo") {
			continue
		}
		imgURL, mime, err := getCommonsImageURL(title, width)
		if err != nil {
			continue
		}
		if !strings.HasPrefix(mime, "image/") {
			continue
		}
		body, status, err := httpDownload(imgURL)
		if err != nil || status != 200 || !isValidImage(body) {
			continue
		}
		if err := saveImage(body, dir, filename); err != nil {
			continue
		}
		return true
	}
	return false
}

// Failed URL -> search terms mapping (based on product names from seed.go)
var failedURLSearches = map[string][]string{
	"photo-1509444154694-2c20049b1c1e":  {"bread bakery", "artisan bread", "bakery"},
	"photo-1457369804619-52c61a3df23d":  {"computer laptop", "office computer", "laptop"},
	"photo-1503676263721-6a1f61fcfcfc":  {"classroom education", "school classroom", "education"},
	"photo-1503951918674-5f8aa154d46c":  {"camera photography", "photographer", "camera"},
	"photo-1504148455328-c3764b6c1f7e":  {"vegetables fresh", "fresh produce", "vegetables"},
	"photo-1506073884694-7631b3b1e9d2":  {"rural village", "countryside", "village"},
	"photo-1517686469429-8408823b9b5b":  {"library books", "books reading", "library"},
	"photo-1518110925495-7d0c1b3c4d9e":  {"farming tools", "garden tools", "agriculture tools"},
	"photo-1522557412597-5927c1cd9eb7":  {"coconut water", "fresh juice", "beverage"},
	"photo-1551703599-6b3e8379aa88":  {"farmer portrait", "rural worker", "farmer"},
	"photo-1559561853-5c8d5d3c9d4e":  {"hospital medical", "healthcare", "medicine"},
	"photo-1563636610-e1e055057a04":  {"milk glass", "dairy milk", "milk"},
	"photo-1585150371909-82d24f1d9b8e":  {"rural house", "countryside home", "house"},
	"photo-1587049352846-c460e1f0e5c0":  {"honey jar", "honey", "beekeeping"},
	"photo-1591857170480-7b4c1f9c7b89":  {"mountain landscape", "mountains", "landscape"},
	"photo-1595941068-8e3a7c1c4d2f":  {"wood workshop", "carpentry", "woodworking"},
	"photo-1549298916-b57d637d1b3e":  {"textile fabric", "weaving", "textile"},
	"photo-1603048719571-4e0a3c9c1d0e":  {"rural farm", "farm land", "agriculture"},
	"photo-1606107557195-0e29a4b5b423":  {"construction tools", "building materials", "construction"},
}

// Demo products that need their own images (currently sharing wrong ones)
var demoProductImages = map[string][]string{
	"queso-de-cabra":    {"goat cheese", "cheese dairy", "cheese"},
	"ruana-de-lana":     {"wool textile", "handwoven textile", "wool fabric"},
	"azadon-de-montana": {"hoe tool", "garden hoe", "agricultural tool"},
	"tijeras-de-podar":  {"pruning shears", "garden scissors", "pruning tool"},
	"aceite-de-romero":  {"essential oil bottle", "herbal oil", "rosemary oil"},
}

func main() {
	os.MkdirAll(productsDir, 0755)
	os.MkdirAll(demoDir, 0755)

	// Step 1: Fix query strings on local paths in seed.go and migration 068
	fmt.Println("=== Paso 1: Limpiar query strings de paths locales ===")
	fixQueryStrings("internal/db/seed.go")
	fixQueryStrings("internal/db/migrations/068_restore_unsplash_urls.sql")

	// Step 2: Download images for failed Unsplash URLs
	fmt.Println("\n=== Paso 2: Descargar imagenes para URLs fallidas ===")
	for photoID, searches := range failedURLSearches {
		filename := "commons-" + photoID + ".jpg"
		localPath := "/images/products/" + filename
		filePath := filepath.Join(productsDir, filename)

		// Check if already exists
		if _, err := os.Stat(filePath); err == nil {
			fmt.Printf("  Ya existe: %s\n", filename)
			continue
		}

		fmt.Printf("  Buscando: %s\n", searches[0])
		success := false
		for _, term := range searches {
			if downloadFromCommons(term, filename, productsDir, 600) {
				fmt.Printf("  OK: %s -> %s\n", term, localPath)
				success = true
				break
			}
		}
		if !success {
			fmt.Printf("  FALLIDO: %s\n", photoID)
		}
		time.Sleep(300 * time.Millisecond)
	}

	// Step 3: Replace remaining Unsplash URLs in seed.go with local paths
	fmt.Println("\n=== Paso 3: Reemplazar URLs restantes de Unsplash ===")
	replaceRemainingUnsplash("internal/db/seed.go")
	replaceRemainingUnsplash("internal/db/migrations/068_restore_unsplash_urls.sql")

	// Step 4: Download missing images for demo products
	fmt.Println("\n=== Paso 4: Descargar imagenes faltantes para productos demo ===")
	for id, searches := range demoProductImages {
		filename := id + ".jpg"
		localPath := "/images/demo/" + filename
		filePath := filepath.Join(demoDir, filename)

		if _, err := os.Stat(filePath); err == nil {
			fmt.Printf("  Ya existe: %s\n", filename)
			continue
		}

		fmt.Printf("  Buscando: %s\n", searches[0])
		success := false
		for _, term := range searches {
			if downloadFromCommons(term, filename, demoDir, 600) {
				fmt.Printf("  OK: %s -> %s\n", term, localPath)
				success = true
				break
			}
		}
		if !success {
			fmt.Printf("  FALLIDO: %s\n", id)
		}
		time.Sleep(300 * time.Millisecond)
	}

	// Step 5: Fix demo products that share wrong images
	fmt.Println("\n=== Paso 5: Corregir productos demo con imagen equivocada ===")
	fixDemoProductImages()

	fmt.Println("\nDone!")
}

func fixQueryStrings(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		fmt.Printf("  Error leyendo %s: %v\n", path, err)
		return
	}
	content := string(data)

	// Remove ?auto=format&fit=crop&w=XXX&q=80 from local paths
	re := regexp.MustCompile(`(/images/(?:products|demo|pages)/[^"?]+\.jpg)\?auto=format&fit=crop&w=\d+&q=80`)
	newContent := re.ReplaceAllString(content, "$1")

	count := strings.Count(content, "?auto=format&fit=crop&w=") - strings.Count(newContent, "?auto=format&fit=crop&w=")

	os.WriteFile(path, []byte(newContent), 0644)
	fmt.Printf("  %s: %d query strings eliminadas\n", path, count)
}

func replaceRemainingUnsplash(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		fmt.Printf("  Error leyendo %s: %v\n", path, err)
		return
	}
	content := string(data)

	// Find all remaining Unsplash URLs
	urlRe := regexp.MustCompile(`https://images\.unsplash\.com/(photo-[a-zA-Z0-9-]+)`)
	matches := urlRe.FindAllStringSubmatch(content, -1)

	// Build replacement map: photoID -> local path
	replaceMap := map[string]string{}
	for _, m := range matches {
		photoID := m[1]
		// Check if we have a downloaded image for this photo ID
		commonsFile := "commons-" + photoID + ".jpg"
		originalFile := photoID + ".jpg"

		if _, err := os.Stat(filepath.Join(productsDir, commonsFile)); err == nil {
			replaceMap[photoID] = "/images/products/" + commonsFile
		} else if _, err := os.Stat(filepath.Join(productsDir, originalFile)); err == nil {
			replaceMap[photoID] = "/images/products/" + originalFile
		}
	}

	// Replace each Unsplash URL with local path
	for photoID, localPath := range replaceMap {
		// Match the full URL including query params
		fullRe := regexp.MustCompile(`https://images\.unsplash\.com/` + regexp.QuoteMeta(photoID) + `[^"]*`)
		content = fullRe.ReplaceAllString(content, localPath)
	}

	os.WriteFile(path, []byte(content), 0644)
	remaining := strings.Count(content, "images.unsplash.com")
	fmt.Printf("  %s: %d URLs restantes\n", path, remaining)
}

func fixDemoProductImages() {
	data, err := os.ReadFile("internal/db/demo_seed.go")
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	content := string(data)

	// Fix: Queso de cabra uses bioconstruccion-adobe.jpg -> queso-de-cabra.jpg
	content = strings.Replace(content,
		`"/images/demo/bioconstruccion-adobe.jpg", 60`,
		`"/images/demo/queso-de-cabra.jpg", 60`, 1)

	// Fix: Ruana de lana uses mermelada.jpg -> ruana-de-lana.jpg
	content = strings.Replace(content,
		`"/images/demo/mermelada.jpg", 250`,
		`"/images/demo/ruana-de-lana.jpg", 250`, 1)

	// Fix: Azadon - empty image -> azadon-de-montana.jpg
	content = strings.Replace(content,
		`"Azadon de montana", "unidad", "Azadon forjado en la herreria comunitaria", "util", "", 100`,
		`"Azadon de montana", "unidad", "Azadon forjado en la herreria comunitaria", "util", "/images/demo/azadon-de-montana.jpg", 100`, 1)

	// Fix: Tijeras de podar - empty image -> tijeras-de-podar.jpg
	content = strings.Replace(content,
		`"Tijeras de podar", "unidad", "Tijeras de podar afiladas en taller", "util", "", 60`,
		`"Tijeras de podar", "unidad", "Tijeras de podar afiladas en taller", "util", "/images/demo/tijeras-de-podar.jpg", 60`, 1)

	// Fix: Aceite de romero - empty image -> aceite-de-romero.jpg
	content = strings.Replace(content,
		`"Aceite de romero (100ml)", "botella", "Aceite esencial de romero del huerto", "natural", "", 45`,
		`"Aceite de romero (100ml)", "botella", "Aceite esencial de romero del huerto", "natural", "/images/demo/aceite-de-romero.jpg", 45`, 1)

	os.WriteFile("internal/db/demo_seed.go", []byte(content), 0644)
	fmt.Println("  Productos demo corregidos")
}
