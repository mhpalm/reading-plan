import { 
    auth, 
    provider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    getRecentActivity,
    calculatePlanProgress
} from './firebase-config.js';
import { generateMCheynePlan } from './reading-plans.js';

// Export everything needed
export { 
    auth, 
    provider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    // ... other exports
};

console.log('Starting app.js initialization');

// Export the navigation function
export function navigateToPlan(planId) {
    console.log('Navigating to plan:', planId);
    window.location.href = `plan.html?id=${planId}`;
}

// Make it available globally for onclick handlers
window.navigateToPlan = navigateToPlan;

// Add auth state observer
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        
        const signInBtn = document.getElementById('signInBtn');
        const signOutBtn = document.getElementById('signOutBtn');
        const userDetails = document.getElementById('user-details');

        if (user) {
            console.log('Updating UI for logged in user:', user.displayName);
            signInBtn.style.display = 'none';
            signOutBtn.style.display = 'block';
            if (userDetails) {
                userDetails.style.display = 'block';
                userDetails.textContent = `Hello, ${user.displayName}`;
            }

            console.log('Generating M\'Cheyne plan');
            const plan = generateMCheynePlan();
            if (plan) {
                console.log('Calculating progress');
                const progress = await calculatePlanProgress('mcheyne', user.uid);
                console.log('Updating progress bar with:', progress);
                updateProgressBar('mcheyne', progress);
            }

            await updateActivityFeed();
        } else {
            console.log('Updating UI for logged out user');
            signInBtn.style.display = 'block';
            signOutBtn.style.display = 'none';
            if (userDetails) {
                userDetails.style.display = 'none';
                userDetails.textContent = '';
            }
        }
    });

    // Clean up the observer when the page is unloaded
    window.addEventListener('unload', () => {
        console.log('Cleaning up auth observer');
        unsubscribe();
    });

    // Sign in handler
    document.getElementById('signInBtn').addEventListener('click', async () => {
        console.log('Sign in button clicked');
        try {
            await signInWithPopup(auth, provider);
            console.log('Sign in successful');
        } catch (error) {
            console.error('Sign-in error:', error);
            alert('Sign-in failed: ' + error.message);
        }
    });

    // Sign out handler
    document.getElementById('signOutBtn').addEventListener('click', async () => {
        console.log('Sign out button clicked');
        try {
            await signOut(auth);
            console.log('Sign out successful');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    });
});

function updateProgressBar(planId, progress) {
    console.log('Updating progress bar for:', planId, progress);
    const progressBar = document.getElementById(`progress-${planId}`);
    const progressText = document.getElementById(`progress-text-${planId}`);
    
    if (progressBar && progressText) {
        progressBar.style.width = `${progress.percent}%`;
        progressBar.className = `progress-fill ${progress.status}`;
        progressText.textContent = `${progress.completed}/${progress.total} readings completed (${progress.percent}%)`;
        console.log('Progress bar updated successfully');
    } else {
        console.log('Progress bar elements not found');
    }
} 

let lastActivityDoc = null;

async function updateActivityFeed(isLoadMore = false) {
    const activityList = document.getElementById('activity-list');
    const loadMoreBtn = document.getElementById('load-more-activity');
    if (!activityList) return;

    try {
        const result = await getRecentActivity(10, isLoadMore ? lastActivityDoc : null);
        const { activities, lastDoc } = result;
        lastActivityDoc = lastDoc;

        if (!activities) {
            console.error('No activities returned');
            return;
        }

        const activityHTML = activities.map(activity => {
            let content = '';
            let link = '';
            
            switch (activity.type) {
                case 'comment':
                    link = `plan.html?id=${activity.planId}&date=${activity.date}`;
                    const commentPreview = activity.comment ? 
                        `<div class="activity-comment-preview">"${activity.comment.substring(0, 100)}${activity.comment.length > 100 ? '...' : ''}"</div>` 
                        : '';
                    content = `
                        <div>
                            <strong>${activity.userName}</strong> commented on ${activity.date}'s readings:
                            ${commentPreview}
                            <a href="${link}" class="activity-link">Go to discussion →</a>
                        </div>`;
                    break;
                case 'completion':
                    const readingLink = `plan.html?id=${activity.planId}&date=${activity.date}`;
                    content = `
                        <div>
                            <strong>${activity.userName}</strong> read ${activity.readingName || 'a reading'}
                        </div>`;
                    break;
            }
            
            return `
                <div class="activity-item">
                    ${content}
                    <div class="activity-time">${activity.timestamp ? new Date(activity.timestamp.toDate()).toLocaleString() : 'Just now'}</div>
                </div>
            `;
        }).join('');

        if (isLoadMore) {
            activityList.innerHTML += activityHTML;
        } else {
            activityList.innerHTML = activityHTML;
        }

        // Show/hide load more button based on whether there are more results
        if (loadMoreBtn) {
            loadMoreBtn.style.display = lastDoc ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Error updating activity feed:', error);
    }
}

// Add this to your HTML
document.getElementById('load-more-activity')?.addEventListener('click', () => {
    updateActivityFeed(true);
}); 