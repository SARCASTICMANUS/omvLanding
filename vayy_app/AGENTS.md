# VAYY Repository Guidelines

## Project Overview

VAYY is a route-based mobility platform for passengers, auto drivers, and bike riders. The platform focuses on route discovery, live tracking, stop-based boarding, and transit intelligence.

## Tech Stack

* React Native + Expo
* TypeScript
<!-- * NativeWind -->
* Redux Toolkit
* React Navigation
* Django Backend
* WebSockets
* MapLibre
* OSM
* OSRM

## Project Structure

* app/ → Expo Router screens
* src/components → Reusable UI
* src/features → Business modules
* src/hooks → Custom hooks
* src/store → Redux
* src/services → API layer
* src/constants → Shared constants

## Design System

* Primary: #009849
* Live Tracking: #00E676
* Radius: 18px
* Mobile-first
* Clean transit UI
* No unnecessary redesigns

## Protected Rules

Do NOT:

* Change business logic
* Rename existing functions
* Change API contracts
* Change Redux state shape
* Break navigation flows
* Remove existing features

## Passenger Flow

Trip Planner
→ Route Match
→ Route Review
→ Live Tracking

## Driver Flow

Driver Trip Planner
→ Route List
→ Route Review
→ Stops Timeline
→ Live Tracking

## Development Rules

* Reuse existing components first
* Edit existing files before creating new files
* Follow existing code patterns
* Keep components modular
* Preserve current functionality

## Maps

* Use MapLibre + OSM
* Use OSRM routing
* Preserve existing map behavior

## Output Rules For Agents

* Use minimum tokens
* Return only changed code when possible
* Avoid long explanations
* Keep changes focused
* Do not generate duplicate implementations


CRITICAL:

Before editing any file:

- Read complete file.
- Read imported components used by the file.
- Preserve all business logic.
- Preserve all hooks.
- Preserve all state.
- Preserve all navigation.
- Preserve all API calls.
- Never generate simplified examples.
- Never return placeholder code.
- Never rewrite a screen from scratch unless explicitly requested.

If the file cannot be read, stop and report missing context.