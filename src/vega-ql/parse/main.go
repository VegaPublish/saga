package main

import (
	"encoding/json"

	"github.com/gopherjs/gopherjs/js"
	"github.com/sanity-io/gradient/pkg/search/gradientql"
)

func parse(query string, params gradientql.Params) (string, error) {
	// Parse parses a string of GradientQL
	expr, err := gradientql.Parse(query, params)
	if err != nil {
		return "", err
	}
	json, err := json.Marshal(expr)
	if err != nil {
		return "", err
	}
	return string(json), nil
}

func main() {
	js.Module.Set("exports", parse)
}
