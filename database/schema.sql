-- Create Database
CREATE DATABASE IF NOT EXISTS robera_tech;
USE robera_tech;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'instructor', 'admin') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    level ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Beginner',
    thumbnail_url VARCHAR(255) DEFAULT '/img/default-course.jpg',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Lessons Table
CREATE TABLE IF NOT EXISTS lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    video_url VARCHAR(255) NOT NULL,
    duration VARCHAR(20),
    sort_order INT DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 4. Enrollments Table (Tracks student purchases/access)
CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_enrollment (user_id, course_id)
);

-- 5. Payments Table (Tracks Chapa transactions securely)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    tx_ref VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Insert Sample High-Impact Courses (For immediate testing)
INSERT INTO courses (title, slug, description, category, price, level) VALUES
('Full-Stack Node.js & Enterprise Architecture', 'fullstack-nodejs-enterprise', 'Master backend scaling, database pooling, secure middlewares, and production deployment.', 'Backend', 149.99, 'Advanced'),
('Modern React & Next.js Masterclass', 'modern-react-nextjs', 'Build lightning-fast server-side rendered web applications with Tailwind CSS and TypeScript.', 'Frontend', 129.99, 'Intermediate'),
('Advanced MySQL & Database Performance', 'advanced-mysql-performance', 'Learn query optimization, indexing strategies, atomic transactions, and connection pooling.', 'Database', 99.99, 'Advanced');