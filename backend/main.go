package main

import (
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	// Serve static files from the frontend dist folder
	r.Static("/assets", "../frontend/dist/assets")
	r.StaticFile("/manifest.webmanifest", "../frontend/dist/manifest.webmanifest")
	r.StaticFile("/sw.js", "../frontend/dist/sw.js")
	r.StaticFile("/favicon.ico", "../frontend/dist/favicon.ico")
	r.StaticFile("/icon-192.png", "../frontend/dist/icon-192.png")
	r.StaticFile("/icon-512.png", "../frontend/dist/icon-512.png")

	// Fallback to index.html for React routing
	r.NoRoute(func(c *gin.Context) {
		c.File("../frontend/dist/index.html")
	})

	r.GET("/api/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	r.Run(":8080")
}
