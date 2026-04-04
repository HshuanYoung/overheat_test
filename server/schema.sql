CREATE DATABASE IF NOT EXISTS overheat;
USE overheat;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER'
);

CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(50) PRIMARY KEY,
    state JSON NOT NULL,
    status INT DEFAULT 0
);

-- Note: The passwords below are hashed with bcrypt. 
-- The plain text password for all these accounts is 'password123'
INSERT IGNORE INTO users (id, username, password_hash, display_name, role) VALUES 
('admin-id', 'admin', '$2a$10$tZ2yYp7m3r1dY4q7Yt2d4O/pW/.4/7T/o.p/w3f1hP2eH2Yv/Fq.O', 'Administrator', 'ADMIN'),
('test1-id', 'test1', '$2a$10$tZ2yYp7m3r1dY4q7Yt2d4O/pW/.4/7T/o.p/w3f1hP2eH2Yv/Fq.O', 'Test User 1', 'USER'),
('test2-id', 'test2', '$2a$10$tZ2yYp7m3r1dY4q7Yt2d4O/pW/.4/7T/o.p/w3f1hP2eH2Yv/Fq.O', 'Test User 2', 'USER'),
('test3-id', 'test3', '$2a$10$tZ2yYp7m3r1dY4q7Yt2d4O/pW/.4/7T/o.p/w3f1hP2eH2Yv/Fq.O', 'Test User 3', 'USER'),
('test4-id', 'test4', '$2a$10$tZ2yYp7m3r1dY4q7Yt2d4O/pW/.4/7T/o.p/w3f1hP2eH2Yv/Fq.O', 'Test User 4', 'USER'),
('test5-id', 'test5', '$2a$10$tZ2yYp7m3r1dY4q7Yt2d4O/pW/.4/7T/o.p/w3f1hP2eH2Yv/Fq.O', 'Test User 5', 'USER');
