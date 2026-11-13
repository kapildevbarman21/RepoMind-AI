import pytest
from app.services.parser.tree_sitter_parser import CodebaseParser

def test_parse_python_ast():
    py_code = b"""
import os
from pathlib import Path

class DatabaseConnection:
    def __init__(self, uri: str):
        self.uri = uri

    def connect(self):
        return True

def execute_query(sql: str):
    return "result"
"""
    functions, classes, imports = CodebaseParser.parse_python_ast(py_code)
    func_names = [f.name for f in functions]
    class_names = [c.name for c in classes]

    assert "DatabaseConnection" in class_names
    assert "execute_query" in func_names
    assert "__init__" in func_names or "connect" in func_names
    assert any("os" in imp or "pathlib" in imp for imp in imports)

def test_parse_javascript_ast():
    js_code = b"""
import express from 'express';

class AuthService {
    verifyToken(token) {
        return true;
    }
}

function startServer(port) {
    console.log("Listening on " + port);
}
"""
    functions, classes, imports = CodebaseParser.parse_js_ts_ast(js_code, "javascript")
    func_names = [f.name for f in functions]
    class_names = [c.name for c in classes]

    assert "AuthService" in class_names
    assert "startServer" in func_names
    assert len(imports) >= 1
