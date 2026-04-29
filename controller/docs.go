package controller

import (
	"fmt"
	"io/fs"
	"path"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

const (
	defaultDocCategory = "通用"
	defaultDocOrder    = 1000
)

var docSlugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type DocMeta struct {
	Slug     string `json:"slug"`
	Title    string `json:"title"`
	Order    int    `json:"order"`
	Category string `json:"category"`
}

type docEntry struct {
	DocMeta
	Content string
}

type docContentResponse struct {
	Slug     string `json:"slug"`
	Title    string `json:"title"`
	Category string `json:"category"`
	Content  string `json:"content"`
}

type docFrontmatter struct {
	Slug     string `yaml:"slug"`
	Title    string `yaml:"title"`
	Order    *int   `yaml:"order"`
	Category string `yaml:"category"`
}

var (
	docsMu     sync.RWMutex
	docsBySlug = map[string]docEntry{}
	docsList   []DocMeta
)

func InitDocs(fsys fs.FS) error {
	entries, list, err := loadDocsFromFS(fsys)
	if err != nil {
		return err
	}

	docsMu.Lock()
	defer docsMu.Unlock()
	docsBySlug = entries
	docsList = list
	return nil
}

func ListDocs(c *gin.Context) {
	docsMu.RLock()
	list := make([]DocMeta, len(docsList))
	copy(list, docsList)
	docsMu.RUnlock()

	common.ApiSuccess(c, list)
}

func GetDocContent(c *gin.Context) {
	slug := strings.TrimSpace(c.Query("slug"))

	docsMu.RLock()
	doc, ok := docsBySlug[slug]
	docsMu.RUnlock()
	if !ok {
		common.ApiErrorMsg(c, "文档不存在")
		return
	}

	common.ApiSuccess(c, docContentResponse{
		Slug:     doc.Slug,
		Title:    doc.Title,
		Category: doc.Category,
		Content:  doc.Content,
	})
}

func loadDocsFromFS(fsys fs.FS) (map[string]docEntry, []DocMeta, error) {
	if fsys == nil {
		return nil, nil, fmt.Errorf("docs fs is nil")
	}

	dirEntries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, nil, fmt.Errorf("read docs directory: %w", err)
	}

	bySlug := make(map[string]docEntry)
	for _, dirEntry := range dirEntries {
		if dirEntry.IsDir() {
			continue
		}
		name := dirEntry.Name()
		if shouldSkipDocFile(name) {
			continue
		}

		data, err := fs.ReadFile(fsys, name)
		if err != nil {
			return nil, nil, fmt.Errorf("read doc %s: %w", name, err)
		}

		doc, err := parseDoc(name, string(data))
		if err != nil {
			return nil, nil, fmt.Errorf("parse doc %s: %w", name, err)
		}
		if _, exists := bySlug[doc.Slug]; exists {
			return nil, nil, fmt.Errorf("duplicate doc slug %q", doc.Slug)
		}
		bySlug[doc.Slug] = doc
	}

	list := make([]DocMeta, 0, len(bySlug))
	for _, doc := range bySlug {
		list = append(list, doc.DocMeta)
	}
	sortDocMetas(list)

	return bySlug, list, nil
}

func shouldSkipDocFile(name string) bool {
	base := path.Base(name)
	if path.Ext(base) != ".md" {
		return true
	}
	if strings.HasPrefix(base, "_") {
		return true
	}

	lower := strings.ToLower(base)
	return lower == "readme.md" ||
		(strings.HasPrefix(lower, "readme.") && strings.HasSuffix(lower, ".md"))
}

func parseDoc(name string, raw string) (docEntry, error) {
	frontmatter, body, hasFrontmatter, err := splitFrontmatter(raw)
	if err != nil {
		return docEntry{}, err
	}

	meta := docFrontmatter{}
	if hasFrontmatter {
		if err := yaml.Unmarshal([]byte(frontmatter), &meta); err != nil {
			return docEntry{}, fmt.Errorf("invalid frontmatter: %w", err)
		}
	}

	slug := strings.TrimSpace(meta.Slug)
	if slug == "" {
		slug = strings.TrimSuffix(path.Base(name), path.Ext(name))
	}
	if !docSlugPattern.MatchString(slug) {
		return docEntry{}, fmt.Errorf("invalid slug %q", slug)
	}

	title := strings.TrimSpace(meta.Title)
	if title == "" {
		title = firstMarkdownH1(body)
	}
	if title == "" {
		title = slug
	}

	category := strings.TrimSpace(meta.Category)
	if category == "" {
		category = defaultDocCategory
	}

	order := defaultDocOrder
	if meta.Order != nil {
		order = *meta.Order
	}

	return docEntry{
		DocMeta: DocMeta{
			Slug:     slug,
			Title:    title,
			Order:    order,
			Category: category,
		},
		Content: strings.TrimLeft(body, "\r\n"),
	}, nil
}

func splitFrontmatter(raw string) (string, string, bool, error) {
	lines := strings.SplitAfter(raw, "\n")
	if len(lines) == 0 || strings.TrimSpace(lines[0]) != "---" {
		return "", raw, false, nil
	}

	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			return strings.Join(lines[1:i], ""), strings.Join(lines[i+1:], ""), true, nil
		}
	}

	return "", "", false, fmt.Errorf("frontmatter is not closed")
}

func firstMarkdownH1(content string) string {
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
		}
	}
	return ""
}

func sortDocMetas(list []DocMeta) {
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].Category != list[j].Category {
			return list[i].Category < list[j].Category
		}
		if list[i].Order != list[j].Order {
			return list[i].Order < list[j].Order
		}
		if list[i].Title != list[j].Title {
			return list[i].Title < list[j].Title
		}
		return list[i].Slug < list[j].Slug
	})
}
