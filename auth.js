// Initialize Firebase Auth provider
const provider = new GoogleAuthProvider();

// Handle sign in
async function signInWithGoogle() {
    try {
        // Add persistence
        await setPersistence(auth, browserLocalPersistence);
        
        // Sign in
        const result = await signInWithPopup(auth, provider);
        
        // Log success
        console.log("Successfully signed in:", result.user.email);
        
        // Update UI or redirect as needed
        window.location.reload();
    } catch (error) {
        // Log detailed error information
        console.error("Sign in error:", error.code, error.message);
        alert("Sign in failed. Please try again.");
    }
}

// Add auth state listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is signed in:", user.email);
        // Update UI for signed in state
    } else {
        console.log("User is signed out");
        // Update UI for signed out state
    }
}); 
