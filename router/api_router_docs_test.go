package router

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type docsRouteResponse struct {
	Success bool                 `json:"success"`
	Message string               `json:"message"`
	Data    []controller.DocMeta `json:"data"`
}

type docContentRouteResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Slug    string `json:"slug"`
		Title   string `json:"title"`
		Content string `json:"content"`
	} `json:"data"`
}

func TestSetApiRouterRegistersPublicDocsRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, controller.InitDocs(fstest.MapFS{
		"guide.md": {
			Data: []byte(`---
slug: guide
title: Guide
---
Guide body.
`),
		},
	}))

	engine := gin.New()
	SetApiRouter(engine)

	listRecorder := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/api/docs/list", nil)
	engine.ServeHTTP(listRecorder, listRequest)

	require.Equal(t, http.StatusOK, listRecorder.Code)
	var listPayload docsRouteResponse
	require.NoError(t, common.Unmarshal(listRecorder.Body.Bytes(), &listPayload))
	require.True(t, listPayload.Success)
	require.Equal(t, []controller.DocMeta{
		{Slug: "guide", Title: "Guide", Order: 1000, Category: "通用"},
	}, listPayload.Data)

	contentRecorder := httptest.NewRecorder()
	contentRequest := httptest.NewRequest(http.MethodGet, "/api/docs/content?slug=guide", nil)
	engine.ServeHTTP(contentRecorder, contentRequest)

	require.Equal(t, http.StatusOK, contentRecorder.Code)
	var contentPayload docContentRouteResponse
	require.NoError(t, common.Unmarshal(contentRecorder.Body.Bytes(), &contentPayload))
	require.True(t, contentPayload.Success)
	require.Equal(t, "guide", contentPayload.Data.Slug)
	require.Equal(t, "Guide", contentPayload.Data.Title)
	require.Contains(t, contentPayload.Data.Content, "Guide body.")
}
