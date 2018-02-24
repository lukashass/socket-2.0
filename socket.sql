-- phpMyAdmin SQL Dump
-- version 4.7.6
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Feb 24, 2018 at 09:39 PM
-- Server version: 10.1.26-MariaDB-0+deb9u1
-- PHP Version: 7.0.27-0+deb9u1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `socket`
--

-- --------------------------------------------------------

--
-- Table structure for table `sockets`
--

CREATE TABLE `sockets` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `desciption` varchar(255) NOT NULL,
  `system_name` varchar(255) NOT NULL,
  `code_on` int(11) NOT NULL,
  `code_off` int(11) NOT NULL,
  `protocol` int(11) NOT NULL,
  `status` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `timers`
--

CREATE TABLE `timers` (
  `id` int(11) NOT NULL,
  `socket_id` int(11) NOT NULL,
  `action` int(11) NOT NULL,
  `minute` varchar(255) NOT NULL DEFAULT '*',
  `hour` varchar(255) NOT NULL DEFAULT '*',
  `dom` varchar(255) NOT NULL DEFAULT '*',
  `month` varchar(255) NOT NULL DEFAULT '*',
  `dow` varchar(255) NOT NULL DEFAULT '*'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `sockets`
--
ALTER TABLE `sockets`
  ADD UNIQUE KEY `id` (`id`);

--
-- Indexes for table `timers`
--
ALTER TABLE `timers`
  ADD UNIQUE KEY `id` (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `sockets`
--
ALTER TABLE `sockets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `timers`
--
ALTER TABLE `timers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
