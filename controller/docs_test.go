package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type docsAPIResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Data    map[string]interface{} `json:"data"`
}

type docsListAPIResponse struct {
	Success bool      `json:"success"`
	Message string    `json:"message"`
	Data    []DocMeta `json:"data"`
}

type docContentAPIResponse struct {
	Success bool               `json:"success"`
	Message string             `json:"message"`
	Data    docContentResponse `json:"data"`
}

func TestLoadDocsFromFS(t *testing.T) {
	fsys := fstest.MapFS{
		"complete.md": {
			Data: []byte(`---
slug: complete-doc
title: Complete Doc
order: 20
category: Beta
---
# Ignored H1

Complete body.
`),
		},
		"fallback.md": {
			Data: []byte(`# Fallback Title

Fallback body.
`),
		},
		"default-category.md": {
			Data: []byte(`---
slug: default-category
title: Default Category
---
No explicit category or order.
`),
		},
		"README.md": {
			Data: []byte(`# Maintainer Notes`),
		},
		"README.zh.md": {
			Data: []byte(`# Maintainer Notes ZH`),
		},
		"_draft.md": {
			Data: []byte(`---
slug: draft-doc
title: Draft
---
Draft body.
`),
		},
	}

	docs, list, err := loadDocsFromFS(fsys)
	require.NoError(t, err)
	require.Len(t, docs, 3)

	complete := docs["complete-doc"]
	require.Equal(t, "Complete Doc", complete.Title)
	require.Equal(t, 20, complete.Order)
	require.Equal(t, "Beta", complete.Category)
	require.NotContains(t, complete.Content, "slug: complete-doc")
	require.Contains(t, complete.Content, "# Ignored H1")

	fallback := docs["fallback"]
	require.Equal(t, "Fallback Title", fallback.Title)
	require.Equal(t, defaultDocOrder, fallback.Order)
	require.Equal(t, defaultDocCategory, fallback.Category)
	require.Contains(t, fallback.Content, "Fallback body.")

	defaultCategory := docs["default-category"]
	require.Equal(t, "Default Category", defaultCategory.Title)
	require.Equal(t, defaultDocOrder, defaultCategory.Order)
	require.Equal(t, defaultDocCategory, defaultCategory.Category)

	require.NotContains(t, docs, "draft-doc")
	require.Equal(t, []DocMeta{
		{Slug: "complete-doc", Title: "Complete Doc", Order: 20, Category: "Beta"},
		{Slug: "default-category", Title: "Default Category", Order: defaultDocOrder, Category: defaultDocCategory},
		{Slug: "fallback", Title: "Fallback Title", Order: defaultDocOrder, Category: defaultDocCategory},
	}, list)
}

func TestLoadDocsFromFSSortOrder(t *testing.T) {
	fsys := fstest.MapFS{
		"b.md": {Data: []byte(`---
slug: b-doc
title: B Title
order: 20
category: Alpha
---
B`)},
		"a.md": {Data: []byte(`---
slug: a-doc
title: A Title
order: 10
category: Alpha
---
A`)},
		"c.md": {Data: []byte(`---
slug: c-doc
title: A Title
order: 10
category: Beta
---
C`)},
		"d.md": {Data: []byte(`---
slug: d-doc
title: B Title
order: 10
category: Alpha
---
D`)},
	}

	_, list, err := loadDocsFromFS(fsys)
	require.NoError(t, err)
	require.Equal(t, []string{"a-doc", "d-doc", "b-doc", "c-doc"}, docSlugs(list))
}

func TestLoadDocsFromFSRejectsNilFS(t *testing.T) {
	_, _, err := loadDocsFromFS(nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "docs fs is nil")
}

func TestLoadDocsFromFSRejectsInvalidSlug(t *testing.T) {
	fsys := fstest.MapFS{
		"bad.md": {
			Data: []byte(`---
slug: Bad Slug
title: Bad
---
Bad body.
`),
		},
	}

	_, _, err := loadDocsFromFS(fsys)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid slug")
}

func TestLoadDocsFromFSRejectsInvalidDerivedSlug(t *testing.T) {
	fsys := fstest.MapFS{
		"Bad_Name.md": {
			Data: []byte(`# Bad Derived Slug

Bad body.
`),
		},
	}

	_, _, err := loadDocsFromFS(fsys)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid slug")
}

func TestLoadDocsFromFSRejectsDuplicateSlug(t *testing.T) {
	fsys := fstest.MapFS{
		"one.md": {
			Data: []byte(`---
slug: same-slug
title: One
---
One body.
`),
		},
		"two.md": {
			Data: []byte(`---
slug: same-slug
title: Two
---
Two body.
`),
		},
	}

	_, _, err := loadDocsFromFS(fsys)
	require.Error(t, err)
	require.Contains(t, err.Error(), "duplicate doc slug")
}

func TestLoadDocsFromFSRejectsUnclosedFrontmatter(t *testing.T) {
	fsys := fstest.MapFS{
		"bad.md": {
			Data: []byte(`---
slug: bad-doc
title: Bad Doc
Bad body.
`),
		},
	}

	_, _, err := loadDocsFromFS(fsys)
	require.Error(t, err)
	require.Contains(t, err.Error(), "frontmatter is not closed")
}

func TestLoadDocsFromFSRejectsInvalidFrontmatterYAML(t *testing.T) {
	fsys := fstest.MapFS{
		"bad.md": {
			Data: []byte(`---
slug: [bad
---
Bad body.
`),
		},
	}

	_, _, err := loadDocsFromFS(fsys)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid frontmatter")
}

func TestListDocsReturnsSortedPublicDocs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, InitDocs(fstest.MapFS{
		"b.md": {
			Data: []byte(`---
slug: b-doc
title: B Doc
order: 20
category: Guide
---
B body.
`),
		},
		"a.md": {
			Data: []byte(`---
slug: a-doc
title: A Doc
order: 10
category: Guide
---
A body.
`),
		},
		"README.md": {
			Data: []byte(`# Maintainer Notes`),
		},
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/docs/list", nil)

	ListDocs(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload docsListAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, []DocMeta{
		{Slug: "a-doc", Title: "A Doc", Order: 10, Category: "Guide"},
		{Slug: "b-doc", Title: "B Doc", Order: 20, Category: "Guide"},
	}, payload.Data)
}

func TestGetDocContentUsesIndexOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, InitDocs(fstest.MapFS{
		"safe.md": {
			Data: []byte(`---
slug: safe-doc
title: Safe Doc
---
Safe body.
`),
		},
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/docs/content?slug=../safe", nil)

	GetDocContent(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload docsAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.False(t, payload.Success)
	require.Equal(t, "文档不存在", payload.Message)
}

func TestGetDocContentTrimsSlugWhitespace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, InitDocs(fstest.MapFS{
		"safe.md": {
			Data: []byte(`---
slug: safe-doc
title: Safe Doc
category: Guide
---
Safe body.
`),
		},
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/docs/content?slug=%20safe-doc%20", nil)

	GetDocContent(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload docContentAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "safe-doc", payload.Data.Slug)
	require.Contains(t, payload.Data.Content, "Safe body.")
}

func TestGetDocContentSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, InitDocs(fstest.MapFS{
		"safe.md": {
			Data: []byte(`---
slug: safe-doc
title: Safe Doc
category: Guide
---
Safe body.
`),
		},
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/docs/content?slug=safe-doc", nil)

	GetDocContent(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var payload docContentAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Equal(t, "safe-doc", payload.Data.Slug)
	require.Equal(t, "Safe Doc", payload.Data.Title)
	require.Equal(t, "Guide", payload.Data.Category)
	require.Contains(t, payload.Data.Content, "Safe body.")
}

func docSlugs(list []DocMeta) []string {
	slugs := make([]string, 0, len(list))
	for _, item := range list {
		slugs = append(slugs, item.Slug)
	}
	return slugs
}
