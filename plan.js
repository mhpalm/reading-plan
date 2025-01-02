import { auth, saveUserProgress, getUserProgress, signOut, calculatePlanProgress, initializeAuth, saveComment, getComments } from './firebase-config.js';
import { generateMCheynePlan } from './reading-plans.js';

console.log('Starting plan.js');

let currentDate = new Date();
let currentPlan = null; // Store plan globally
let planId = null; // Add this global variable
let currentDisplayDate = null; // Add this to track the currently displayed date

// Add loadComments function outside DOMContentLoaded
async function loadComments(planId, date) {
    console.log('Loading comments for:', planId, date);
    const commentsList = document.getElementById('comments-list');
    const comments = await getComments(planId, date);
    console.log('Retrieved comments:', comments);
    
    commentsList.innerHTML = comments.map(comment => `
        <div class="comment">
            <div class="comment-header">
                <span class="comment-author">${comment.userName}</span>
                <span class="comment-time">${comment.timestamp ? new Date(comment.timestamp.toDate()).toLocaleString() : 'Just now'}</span>
            </div>
            <div class="comment-content">${comment.comment}</div>
        </div>
    `).join('');
}

// Move loadReadings outside DOMContentLoaded
async function loadReadings(date, plan) {
    console.log('Loading readings for:', date);
    currentDisplayDate = date;
    const readings = plan.filter(reading => reading.date === date);
    const readingsContainer = document.getElementById('readings');
    const currentDaySpan = document.getElementById('current-day');
    const currentDateSpan = document.getElementById('current-date');
    const progress = auth.currentUser ? await getUserProgress(auth.currentUser.uid) : {};

    // Update current day display
    const [month, day] = date.split('/').map(Number);
    const dayOfYear = Math.floor((new Date(currentDate.getFullYear(), month - 1, day) - new Date(currentDate.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    currentDaySpan.textContent = dayOfYear;
    
    // Update the date display with just the formatted date
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    currentDateSpan.textContent = `${monthNames[month - 1]} ${day}`;

    // Generate readings HTML with accordion
    readingsContainer.innerHTML = readings.map(reading => `
        <div class="reading-item">
            <div class="reading-header">
                <label class="reading-checkbox">
                    <input type="checkbox" 
                        data-reading-id="${reading.id}"
                        ${progress[reading.id] ? 'checked' : ''}
                    >
                    <span class="checkmark"></span>
                </label>
                <button class="accordion-button" data-passage="${reading.name}">
                    ${reading.name}
                    <span class="accordion-icon">▼</span>
                </button>
            </div>
            <div class="passage-content" id="passage-${reading.id}">
                <div class="loading-spinner">Loading passage...</div>
            </div>
        </div>
    `).join('');

    // Add event listeners to checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            if (auth.currentUser) {
                await saveProgress(e.target.dataset.readingId, e.target.checked);
                const updatedProgress = await calculatePlanProgress(auth.currentUser.uid, plan);
                updatePlanProgress(updatedProgress);
            } else {
                e.target.checked = !e.target.checked;
                alert('Please sign in to track your progress');
            }
        });
    });

    // Add event listeners to accordion buttons
    document.querySelectorAll('.accordion-button').forEach(button => {
        button.addEventListener('click', async (e) => {
            const content = e.target.closest('.reading-item').querySelector('.passage-content');
            const icon = e.target.querySelector('.accordion-icon');
            
            // Toggle active class
            button.classList.toggle('active');
            
            // Toggle content visibility
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
                icon.textContent = '▼';
            } else {
                // Load link if not already loaded
                if (content.querySelector('.loading-spinner')) {
                    const passage = button.dataset.passage;
                    content.innerHTML = await fetchBiblePassage(passage);
                }
                content.style.maxHeight = content.scrollHeight + "px";
                icon.textContent = '▲';
            }
        });
    });

    // Load comments for this date
    await loadComments(planId, date);
}

// Add Bible API function
async function fetchBiblePassage(passage) {
    // Simply return the formatted link HTML
    return `
        <div class="passage-fallback">
            <a href="https://www.esv.org/${encodeURIComponent(passage)}" 
               target="_blank" 
               rel="noopener noreferrer"
               class="esv-link">
                Read ${passage}
            </a>
        </div>
    `;
}

// Move setupNavigationListeners outside too
function setupNavigationListeners(plan, currentDate) {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    const dates = [...new Set(plan.map(reading => reading.date))].sort((a, b) => {
        const [aMonth, aDay] = a.split('/').map(Number);
        const [bMonth, bDay] = b.split('/').map(Number);
        return aMonth === bMonth ? aDay - bDay : aMonth - bMonth;
    });

    const currentIndex = dates.indexOf(currentDate);

    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= dates.length - 1;

    prevBtn.onclick = () => {
        if (currentIndex > 0) {
            loadReadings(dates[currentIndex - 1], plan);
            setupNavigationListeners(plan, dates[currentIndex - 1]);
        }
    };

    nextBtn.onclick = () => {
        if (currentIndex < dates.length - 1) {
            loadReadings(dates[currentIndex + 1], plan);
            setupNavigationListeners(plan, dates[currentIndex + 1]);
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    planId = urlParams.get('id');
    const specificDate = urlParams.get('date'); // Add support for direct date loading
    
    if (!planId) {
        window.location.href = 'index.html';
        return;
    }

    // Initialize the page
    switch(planId) {
        case 'mcheyne':
            currentPlan = generateMCheynePlan();
            break;
        default:
            window.location.href = 'index.html';
            return;
    }

    // Initialize auth with proper date handling
    initializeAuth(async user => {
        if (user) {
            const firstIncompleteDay = await findFirstIncompleteDay(user.uid, currentPlan);
            const today = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
            const dateToLoad = specificDate || firstIncompleteDay || today;
            loadReadings(dateToLoad, currentPlan);
            setupNavigationListeners(currentPlan, dateToLoad);
            document.getElementById('sign-out-btn').style.display = 'block';
        } else {
            const today = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
            const dateToLoad = specificDate || today;
            loadReadings(dateToLoad, currentPlan);
            setupNavigationListeners(currentPlan, dateToLoad);
            document.getElementById('sign-out-btn').style.display = 'none';
        }
    });

    // Update comment handling
    document.getElementById('post-comment')?.addEventListener('click', async () => {
        const commentInput = document.getElementById('comment-input');
        const comment = commentInput.value.trim();
        
        if (comment && auth.currentUser) {
            try {
                console.log('Attempting to save comment:', {
                    userId: auth.currentUser.uid,
                    planId: planId,
                    date: currentDisplayDate, // Use the current display date
                    comment: comment
                });
                
                await saveComment(
                    auth.currentUser.uid,
                    planId,
                    currentDisplayDate, // Use the current display date
                    comment
                );
                
                console.log('Comment saved successfully');
                commentInput.value = '';
                await loadComments(planId, currentDisplayDate);
            } catch (error) {
                console.error('Error posting comment:', error);
                alert(`Failed to post comment: ${error.message}`);
            }
        } else {
            if (!auth.currentUser) {
                alert('Please sign in to post comments');
            } else if (!comment) {
                alert('Please enter a comment');
            }
        }
    });
});

// Helper functions remain the same
async function saveProgress(readingId, completed) {
    if (auth.currentUser) {
        await saveUserProgress(auth.currentUser.uid, readingId, completed);
    }
}

async function findFirstIncompleteDay(userId, plan) {
    const progress = await getUserProgress(userId);
    const dates = [...new Set(plan.map(reading => reading.date))].sort((a, b) => {
        const [aMonth, aDay] = a.split('/').map(Number);
        const [bMonth, bDay] = b.split('/').map(Number);
        return aMonth === bMonth ? aDay - bDay : aMonth - bMonth;
    });

    for (const date of dates) {
        const dayReadings = plan.filter(reading => reading.date === date);
        const allComplete = dayReadings.every(reading => progress[reading.id]);
        if (!allComplete) return date;
    }
    return dates[0];
}

export {
    generateMCheynePlan
};