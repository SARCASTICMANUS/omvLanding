# VAYY - Project Context

## Overview

VAYY is a route-first mobility platform focused on Auto and Bike transportation.

The platform helps daily commuters discover, track, and connect with vehicles already travelling on their route.

Unlike traditional ride-hailing platforms, VAYY prioritizes route matching, stop-based pickups, visibility, and efficient vehicle utilization.

Goals:

* Reduce passenger waiting time
* Reduce ride rejections
* Improve route visibility
* Increase driver utilization
* Reduce fuel wastage
* Reduce traffic congestion
* Improve daily commuting experience

---

# Core Philosophy

Traditional Apps:

Passenger → Book Ride → Driver Accepts → Trip Starts

VAYY:

Vehicle Already Moving → Route Visibility → Passenger Discovery → Raise Hand → Pickup → Trip Starts

VAYY is a route discovery and matching platform.

---

# Supported Mobility Modes

## Auto

Shared Auto Mobility

Purpose:

Help passengers find autos already travelling toward their destination.

Benefits:

* Faster matching
* Reduced waiting
* Higher auto occupancy
* More driver earnings

---

## Bike

Bike Commuter Mobility

Purpose:

Help passengers discover riders already moving in the same direction.

Benefits:

* Lower waiting times
* Fewer ride rejections
* Better rider utilization
* Additional rider income

---

# Passenger Journey

## 1. Route Search

Passenger enters:

* Pickup
* Destination

System finds:

* Nearby stops
* Matching routes
* Available autos
* Available bikes

---

## 2. Route Discovery

Passenger views:

* Route
* ETA
* Vehicle direction
* Distance

---

## 3. Live Tracking

Passenger can track:

* Auto location
* Bike location
* ETA updates
* Route progress

---

## 4. Raise Hand

Passenger reaches stop.

Passenger taps:

Raise Hand

Driver receives:

Passenger waiting ahead.

---

## 5. Pickup

Passenger boards vehicle.

Verification methods:

* OTP
* QR
* Confirmation Code

---

# Auto Module

Folder:

src/auto

Purpose:

Shared auto route matching.

Features:

* Auto Discovery
* Route Matching
* Passenger Ahead Alerts
* Boarding Verification
* Driver Tracking
* Live Tracking

Core Rule:

Autos continue on existing routes.

Passengers are matched to the route.

---

# Bike Module

Folder:

src/bike

Purpose:

Bike ride matching.

Features:

* Rider Discovery
* Route Matching
* Pickup Stop Navigation
* Pre-Ride Tracking
* Live Ride Tracking
* Ride Verification

Core Rule:

Riders moving in similar directions are surfaced first.

---

# Driver Module

Folder:

src/driver

Purpose:

Driver operations.

Features:

* Vehicle Selection
* Route Selection
* Passenger Notifications
* Live Tracking
* Trip History

Driver receives:

* Passenger ahead alerts
* Stop pickup requests
* Route demand visibility

---

# Routes Module

Folder:

src/routes

Purpose:

Route intelligence layer.

Features:

* Route Creation
* Route Library
* Route Matching
* Route Details
* Stop Timeline

All matching is route-driven.

---

# Handshake Module

Folder:

src/handshake

Purpose:

Passenger-driver connection system.

Features:

* Raise Hand
* Passenger Alerts
* OTP Verification
* QR Verification
* Boarding Confirmation

---

# Tracking Module

Folder:

src/tracking

Purpose:

Real-time visibility.

Features:

* Auto Tracking
* Bike Tracking
* ETA Updates
* Route Rendering

---

# Navigation Layer

Folder:

src/navigation

Contains:

* Auth Navigator
* Passenger Navigator
* Driver Navigator
* Auto Driver Navigator
* Bike Driver Navigator

---

# Shared Components

Folder:

src/shared

Contains:

* Design System
* UI Components
* Buttons
* Cards
* Inputs
* Navigation Components
* Utilities
* Localization

---

# Design System

Primary Brand Color:

#009849

Background:

#F8FAF9

Card Background:

#FFFFFF

Principles:

* Clean
* Mobile First
* Transit Focused
* Minimal Friction
* High Readability

---

# Technical Stack

Frontend:

* React Native
* Expo

State Management:

* Redux Toolkit

Navigation:

* React Navigation

Maps:

* MapLibre
* OpenStreetMap

Routing:

* OSRM

Backend:

* Node.js
* Express

Database:

* PostgreSQL
* PostGIS

Realtime:

* WebSocket

---

# Product Vision

Build India's most efficient route-based Auto and Bike commuter network.

Enable commuters to instantly discover available transportation moving in their direction while helping drivers maximize occupancy, earnings, and efficiency.
