import React, { useState, useEffect, useCallback } from 'react';

// IMPORTANT: Replace these placeholders with your actual Firebase project configuration
// You can find this in your Firebase Console -> Project settings -> Your apps -> Web app
const YOUR_FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID_FROM_FIREBASE",
    measurementId: "YOUR_MEASUREMENT_ID" // Optional
};

// You can define a fixed app ID for your deployment, e.g., 'sai-vista-ganesh-aarti'
const DEPLOYMENT_APP_ID = 'sai-vista-ganesh-aarti-2025';

// For GitHub Pages, there's no __initial_auth_token. We'll sign in anonymously.
const initialAuthToken = null; // Keep this null for GitHub Pages deployment

// Admin WhatsApp number for group joining/modifications
const ADMIN_WHATSAPP_NUMBER = '8149525915';

// Date range for nominations
const START_DATE = new Date('2025-08-27T00:00:00');
const END_DATE = new Date('2025-09-06T23:59:59');

// Helper to format date for display
const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Main App component
function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loadingFirebase, setLoadingFirebase] = useState(true);
    const [errorFirebase, setErrorFirebase] = useState(null);

    // Initialize Firebase and set up auth listener
    useEffect(() => {
        // Ensure window.firebase is available from the HTML script
        if (!window.firebase) {
            setErrorFirebase("Firebase SDK not loaded. Check index.html script tags.");
            setLoadingFirebase(false);
            return;
        }

        try {
            const app = window.firebase.initializeApp(YOUR_FIREBASE_CONFIG);
            const firestoreDb = window.firebase.getFirestore(app);
            const firebaseAuth = window.firebase.getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Sign in anonymously or with custom token
            const authenticate = async () => {
                try {
                    if (initialAuthToken) {
                        await window.firebase.signInWithCustomToken(firebaseAuth, initialAuthToken);
                    } else {
                        await window.firebase.signInAnonymously(firebaseAuth);
                    }
                } catch (e) {
                    console.error("Firebase authentication failed:", e);
                    setErrorFirebase("Failed to authenticate with Firebase. Please try again later.");
                } finally {
                    setLoadingFirebase(false);
                }
            };

            // Listen for auth state changes to get userId
            const unsubscribe = window.firebase.onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    setUserId(null); // User is signed out
                }
                setLoadingFirebase(false); // Auth state is ready
            });

            authenticate(); // Start authentication process

            return () => unsubscribe(); // Cleanup auth listener
        } catch (e) {
            console.error("Firebase initialization failed:", e);
            setErrorFirebase("Failed to initialize Firebase. Please check configuration.");
            setLoadingFirebase(false);
        }
    }, []);

    if (loadingFirebase) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-200 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                    <p className="text-lg font-semibold text-gray-700">Loading application...</p>
                </div>
            </div>
        );
    }

    if (errorFirebase) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-200 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg text-red-600 text-center">
                    <p className="text-lg font-semibold mb-4">Error:</p>
                    <p>{errorFirebase}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-200 p-4 font-inter">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md md:max-w-lg lg:max-w-xl">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-center mb-4 text-orange-700">
                    Sai Vista Ganesh Festival Celebration 2025
                </h1>
                <h2 className="text-xl sm:text-2xl font-semibold text-center mb-6 text-orange-600">
                    Aarti Nomination
                </h2>
                {userId && db ? (
                    <NominationForm db={db} userId={userId} />
                ) : (
                    <p className="text-center text-red-500">Firebase not fully initialized or user not authenticated.</p>
                )}
            </div>
        </div>
    );
}

// Nomination Form Component
function NominationForm({ db, userId }) {
    const [fullName, setFullName] = useState('');
    const [flatNo, setFlatNo] = useState('');
    const [whatsappNo, setWhatsappNo] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [bringOwnThali, setBringOwnThali] = useState(false);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [registrationData, setRegistrationData] = useState([]);
    const [submitError, setSubmitError] = useState('');

    // Regex for flat number validation: Wing (A-F), Floor (1-13), Flat (01-04)
    // Examples: A-101, B-902, F-1002, F-1304
    const flatNoRegex = /^[A-F]-((10[1-4])|([2-9]0[1-4])|(1[0-3]0[1-4]))$/;
    // Regex for 10-digit Indian WhatsApp number
    const whatsappRegex = /^[6-9]\d{9}$/;

    // Fetch registration data for the graph
    useEffect(() => {
        if (!db) return;

        // Ensure window.firebase is available
        if (!window.firebase) {
            console.error("Firebase SDK not loaded for data fetching.");
            return;
        }

        const q = window.firebase.query(window.firebase.collection(db, `artifacts/${DEPLOYMENT_APP_ID}/public/data/nominations`));
        const unsubscribe = window.firebase.onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => doc.data());
            setRegistrationData(data);
        }, (error) => {
            console.error("Error fetching registration data:", error);
            // Don't set a critical error here, as form submission can still proceed
        });

        return () => unsubscribe();
    }, [db]);

    // Validate form fields
    const validateForm = useCallback(() => {
        const newErrors = {};
        if (!fullName.trim()) newErrors.fullName = 'Full Name is required.';
        if (!flatNo.trim()) {
            newErrors.flatNo = 'Flat No. is required.';
        } else if (!flatNoRegex.test(flatNo.toUpperCase())) { // Convert to uppercase for validation
            newErrors.flatNo = 'Invalid Flat No. (e.g., A-101, B-902, F-1002, F-1304).';
        }
        if (!whatsappNo.trim()) {
            newErrors.whatsappNo = 'WhatsApp Number is required.';
        } else if (!whatsappRegex.test(whatsappNo)) {
            newErrors.whatsappNo = 'Invalid WhatsApp Number (10 digits, starts with 6-9).';
        }
        if (!selectedDate) {
            newErrors.selectedDate = 'Date is required.';
        } else {
            const date = new Date(selectedDate);
            if (date < START_DATE || date > END_DATE) {
                newErrors.selectedDate = `Date must be between ${formatDate(START_DATE)} and ${formatDate(END_DATE)}.`;
            }
        }
        if (!selectedSlot) newErrors.selectedSlot = 'Please select a slot.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [fullName, flatNo, whatsappNo, selectedDate, selectedSlot, flatNoRegex, whatsappRegex]);

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            // Ensure window.firebase is available
            if (!window.firebase) {
                setSubmitError("Firebase SDK not loaded. Cannot submit.");
                setLoading(false);
                return;
            }

            // Split flatNo into wing and flat number for better storage/querying
            const [wing, flatNum] = flatNo.toUpperCase().split('-');

            await window.firebase.addDoc(window.firebase.collection(db, `artifacts/${DEPLOYMENT_APP_ID}/public/data/nominations`), {
                userId: userId, // Store the user ID for potential future management
                fullName: fullName.trim(),
                flatNo: flatNum, // Store just the number part
                wing: wing,     // Store just the wing part
                whatsappNo: whatsappNo.trim(),
                selectedDate: selectedDate,
                selectedSlot: selectedSlot,
                bringOwnThali: bringOwnThali,
                timestamp: new Date(),
            });
            setSuccess(true);
            // Clear form fields after successful submission
            setFullName('');
            setFlatNo('');
            setWhatsappNo('');
            setSelectedDate('');
            setSelectedSlot('');
            setBringOwnThali(false);
            setErrors({});
        } catch (e) {
            console.error("Error adding document: ", e);
            setSubmitError('Failed to register. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Aggregate data for the graph
    const getSlotCounts = useCallback(() => {
        const counts = {};
        const dates = [];
        for (let d = new Date(START_DATE); d <= END_DATE; d.setDate(d.getDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            dates.push(dateString);
            counts[dateString] = { morning: 0, evening: 0 };
        }

        registrationData.forEach(nomination => {
            const dateString = nomination.selectedDate;
            if (counts[dateString]) {
                if (nomination.selectedSlot === 'Morning') {
                    counts[dateString].morning++;
                } else if (nomination.selectedSlot === 'Evening') {
                    counts[dateString].evening++;
                }
            }
        });

        return { counts, dates };
    }, [registrationData]);

    const { counts, dates } = getSlotCounts();

    if (success) {
        return (
            <SuccessMessage adminWhatsapp={ADMIN_WHATSAPP_NUMBER} />
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
                <label htmlFor="fullName" className="block text-gray-700 text-sm font-bold mb-2">
                    Complete Name:
                </label>
                <input
                    type="text"
                    id="fullName"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 transition duration-200"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                />
                {errors.fullName && <p className="text-red-500 text-xs italic mt-1">{errors.fullName}</p>}
            </div>

            {/* Flat No and Wing Number */}
            <div>
                <label htmlFor="flatNo" className="block text-gray-700 text-sm font-bold mb-2">
                    Flat No. and Wing:
                </label>
                <input
                    type="text"
                    id="flatNo"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 transition duration-200"
                    placeholder="e.g., A-101, B-902, F-1002, F-1304"
                    value={flatNo}
                    onChange={(e) => setFlatNo(e.target.value)}
                    required
                />
                {errors.flatNo && <p className="text-red-500 text-xs italic mt-1">{errors.flatNo}</p>}
            </div>

            {/* WhatsApp Number */}
            <div>
                <label htmlFor="whatsappNo" className="block text-gray-700 text-sm font-bold mb-2">
                    WhatsApp Number:
                </label>
                <input
                    type="tel" // Use tel type for better mobile keyboard
                    id="whatsappNo"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 transition duration-200"
                    placeholder="e.g., 9876543210"
                    value={whatsappNo}
                    onChange={(e) => setWhatsappNo(e.target.value)}
                    required
                    maxLength="10"
                />
                {errors.whatsappNo && <p className="text-red-500 text-xs italic mt-1">{errors.whatsappNo}</p>}
            </div>

            {/* Date Selection */}
            <div>
                <label htmlFor="selectedDate" className="block text-gray-700 text-sm font-bold mb-2">
                    Select Date:
                </label>
                <input
                    type="date"
                    id="selectedDate"
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 transition duration-200"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={START_DATE.toISOString().split('T')[0]}
                    max={END_DATE.toISOString().split('T')[0]}
                    required
                />
                {errors.selectedDate && <p className="text-red-500 text-xs italic mt-1">{errors.selectedDate}</p>}
            </div>

            {/* Morning/Evening Slot */}
            <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                    Select Slot:
                </label>
                <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            className="form-radio text-orange-600 focus:ring-orange-500"
                            name="slot"
                            value="Morning"
                            checked={selectedSlot === 'Morning'}
                            onChange={(e) => setSelectedSlot(e.target.value)}
                            required
                        />
                        <span className="ml-2 text-gray-700">Morning Slot</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            className="form-radio text-orange-600 focus:ring-orange-500"
                            name="slot"
                            value="Evening"
                            checked={selectedSlot === 'Evening'}
                            onChange={(e) => setSelectedSlot(e.target.value)}
                            required
                        />
                        <span className="ml-2 text-gray-700">Evening Slot</span>
                    </label>
                </div>
                {errors.selectedSlot && <p className="text-red-500 text-xs italic mt-1">{errors.selectedSlot}</p>}
            </div>

            {/* Checkbox for Pooja Thali */}
            <div className="flex items-center">
                <input
                    type="checkbox"
                    id="bringOwnThali"
                    className="form-checkbox h-5 w-5 text-orange-600 rounded focus:ring-orange-500"
                    checked={bringOwnThali}
                    onChange={(e) => setBringOwnThali(e.target.checked)}
                />
                <label htmlFor="bringOwnThali" className="ml-2 text-gray-700 text-sm">
                    I will bring my own pooja thali and prasad.
                </label>
            </div>

            {/* Registration Graph */}
            <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Registrations Per Slot:</h3>
                <div className="overflow-x-auto">
                    <div className="min-w-full flex flex-col">
                        {dates.map(date => (
                            <div key={date} className="mb-4 p-2 bg-orange-50 rounded-lg shadow-sm">
                                <p className="text-sm font-medium text-gray-800 mb-2">{formatDate(new Date(date))}</p>
                                <div className="flex flex-col sm:flex-row sm:space-x-4">
                                    <div className="flex-1 mb-2 sm:mb-0">
                                        <div className="text-xs text-gray-600 mb-1">Morning: {counts[date]?.morning || 0}</div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className="bg-orange-500 h-2.5 rounded-full"
                                                style={{ width: `${Math.min(100, (counts[date]?.morning || 0) * 10)}%` }} // Scale for visualization
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-600 mb-1">Evening: {counts[date]?.evening || 0}</div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className="bg-orange-500 h-2.5 rounded-full"
                                                style={{ width: `${Math.min(100, (counts[date]?.evening || 0) * 10)}%` }} // Scale for visualization
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    *Graph shows current registrations. Max 10 per slot for visual scaling.
                </p>
            </div>

            {/* Submit Button */}
            <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:scale-105 shadow-md"
                disabled={loading}
            >
                {loading ? 'Registering...' : 'Register for Aarti'}
            </button>

            {submitError && <p className="text-red-500 text-center text-sm mt-2">{submitError}</p>}
        </form>
    );
}

// Success Message Component
function SuccessMessage({ adminWhatsapp }) {
    const whatsappLink = `https://wa.me/${adminWhatsapp}`;
    return (
        <div className="text-center p-6 bg-green-50 rounded-lg shadow-md">
            <svg className="mx-auto h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 className="mt-4 text-xl font-semibold text-green-700">Registration Successful!</h3>
            <p className="mt-2 text-gray-600">
                Thank you for your Aarti nomination. We look forward to celebrating with you!
            </p>
            <p className="mt-4 text-gray-700 text-sm">
                For any modifications to your registration or to join the Sai Vista Ganesh Festival WhatsApp group for updates, please contact the admin:
            </p>
            <p className="mt-2 text-lg font-bold text-orange-600">
                {adminWhatsapp}
            </p>
            <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-200 transform hover:scale-105"
            >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.04 2c-5.45 0-9.91 4.46-9.91 9.91 0 1.75.46 3.45 1.35 4.95L2.05 22l5.12-1.34c1.44.79 3.08 1.23 4.87 1.23 5.45 0 9.91-4.46 9.91-9.91S17.49 2 12.04 2zm5.59 14.59c-.2.5-.78.78-1.28.78-.5 0-.98-.2-1.28-.5-.3-.3-.43-.7-.43-1.28v-2.12c0-.5.2-.98.5-1.28.3-.3.7-.43 1.28-.43h.71c.5 0 .98.2 1.28.5.3.3.43.7.43 1.28v.71c0 .5-.2.98-.5 1.28-.3.3-.7.43-1.28.43zm-2.12-3.54v-1.41c0-.5.2-.98.5-1.28.3-.3.7-.43 1.28-.43h.71c.5 0 .98.2 1.28.5.3.3.43.7.43 1.28v1.41c0 .5-.2.98-.5 1.28-.3.3-.7.43-1.28.43h-.71c-.5 0-.98-.2-1.28-.5-.3-.3-.43-.7-.43-1.28z"></path>
                </svg>
                Contact Admin on WhatsApp
            </a>
        </div>
    );
}

// Mount the App component to the DOM
const rootElement = document.getElementById('root');
if (rootElement) {
    // Using ReactDOM.createRoot for React 18
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(App));
} else {
    console.error("Root element with ID 'root' not found in the DOM.");
}

