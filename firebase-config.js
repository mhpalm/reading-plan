import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc,
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { generateMCheynePlan } from './reading-plans.js';

const firebaseConfig = {
    apiKey: "AIzaSyAXZe70GtmTr5Wn-tJs1CHI2hQcdm0xMrk",
    authDomain: "bible-reading-plan-b28a7.firebaseapp.com",
    projectId: "bible-reading-plan-b28a7",
    storageBucket: "bible-reading-plan-b28a7.firebasestorage.app",
    messagingSenderId: "661240197703",
    appId: "1:661240197703:web:7a9fad6f79cccab39a7762"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Firestore helper functions
const saveUserProgress = async (userId, readingId, completed) => {
    try {
        const userDoc = doc(db, 'progress', userId);
        await setDoc(userDoc, {
            [readingId]: completed
        }, { merge: true });

        if (completed) {
            // Get reading name from the readingId directly
            const [planId, dayNum, columnIndex] = readingId.split('-');
            const reading = planId === 'mcheyne' ? 
                generateMCheynePlan().find(r => r.id === readingId) : null;
            
            await addActivity('completion', {
                userId,
                readingId,
                readingName: reading ? reading.name : readingId,
                planId,
                date: reading ? reading.date : null,
                userName: auth.currentUser.displayName,
                timestamp: serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Error saving progress:", error);
    }
};

const getUserProgress = async (userId) => {
    try {
        const userDoc = await getDoc(doc(db, 'progress', userId));
        return userDoc.exists() ? userDoc.data() : {};
    } catch (error) {
        console.error("Error getting progress:", error);
        return {};
    }
};

async function calculatePlanProgress(planId, userId) {
    try {
        if (!userId || !planId) {
            console.log('Missing userId or planId:', { userId, planId });
            return {
                percent: 0,
                completed: 0,
                total: 1460,
                status: 'not-started'
            };
        }

        const progressRef = doc(db, 'progress', userId);
        const progressDoc = await getDoc(progressRef);
        
        if (!progressDoc.exists()) {
            return {
                percent: 0,
                completed: 0,
                total: 1460,
                status: 'not-started'
            };
        }

        const progress = progressDoc.data();
        // Count only the completed readings for this specific plan
        const planReadings = progress[planId] || {};
        const completedReadings = Object.entries(planReadings)
            .filter(([_, isCompleted]) => isCompleted === true).length;
        
        console.log('Completed readings:', completedReadings); // Debug log
        
        const totalReadings = 1460; // M'Cheyne plan total readings
        const percentComplete = Math.round((completedReadings / totalReadings) * 100);

        return {
            percent: percentComplete,
            completed: completedReadings,
            total: totalReadings,
            status: percentComplete === 100 ? 'completed' : 'in-progress'
        };
    } catch (error) {
        console.error('Error calculating progress:', error);
        return {
            percent: 0,
            completed: 0,
            total: 1460,
            status: 'error'
        };
    }
}

// Initialize auth state observer only once
let authInitialized = false;
const initializeAuth = (callback) => {
    if (!authInitialized) {
        authInitialized = true;
        onAuthStateChanged(auth, callback);
    }
};

// Add new functions for comments and activity
const saveComment = async (userId, planId, date, comment) => {
    try {
        console.log('Saving comment with data:', { userId, planId, date, comment });
        
        if (!userId || !planId || !date || !comment) {
            throw new Error('Missing required fields for comment');
        }

        const commentRef = await addDoc(collection(db, 'comments'), {
            userId,
            planId,
            date,
            comment,
            userName: auth.currentUser.displayName,
            timestamp: serverTimestamp()
        });
        
        console.log('Comment saved with ID:', commentRef.id);
        
        // Add to activity feed with comment preview
        await addActivity('comment', {
            userId,
            planId,
            date,
            comment, // Include the full comment in activity
            userName: auth.currentUser.displayName,
            timestamp: serverTimestamp()
        });
        
        return commentRef.id;
    } catch (error) {
        console.error("Error saving comment:", error);
        throw new Error(`Failed to save comment: ${error.message}`);
    }
};

const getComments = async (planId, date) => {
    try {
        console.log('Fetching comments for:', planId, date);
        const q = query(
            collection(db, 'comments'),
            where('planId', '==', planId),
            where('date', '==', date),
            orderBy('timestamp', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const comments = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('Retrieved comments:', comments);
        return comments;
    } catch (error) {
        console.error("Error getting comments:", error);
        return [];
    }
};

const addActivity = async (type, data) => {
    try {
        await addDoc(collection(db, 'activity'), {
            type,
            ...data,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error adding activity:", error);
    }
};

const getRecentActivity = async (limitCount = 20) => {
    try {
        console.log('Fetching recent activity');
        const q = query(
            collection(db, 'activity'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const querySnapshot = await getDocs(q);
        const activities = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log('Retrieved activities:', activities);
        return {
            activities,
            lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1]
        };
    } catch (error) {
        console.error("Error getting activity:", error);
        return {
            activities: [],
            lastDoc: null
        };
    }
};

export {
    auth,
    db,
    signOut,
    signInWithPopup,
    provider,
    saveUserProgress,
    getUserProgress,
    calculatePlanProgress,
    initializeAuth,
    saveComment,
    getComments,
    getRecentActivity,
    onAuthStateChanged
}; 