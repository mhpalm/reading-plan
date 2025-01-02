# Bible Reading Tracker

A web application for tracking daily Bible readings using the M'Cheyne reading plan.

## Features
- Daily Bible readings
- Progress tracking
- Comments and discussions
- Recent activity feed
- Google authentication

## Setup
1. Clone the repository
2. Copy `.env.template` to `.env`
3. Add your Firebase credentials to `.env`
4. Run `node generate-config.js` to create firebase-config.js
5. Deploy to GitHub Pages

## Environment Setup
1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Google Authentication
3. Create a Firestore database
4. Add your Firebase configuration to `firebase-config.js`

## Development
1. Never commit `firebase-config.js`
2. Use the template file for reference
3. Keep your credentials secure 