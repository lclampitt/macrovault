1. Clone the Repository
    git clone https://github.com/lclampitt/gainlytics
    cd gainlytics
2. Backend Setup (FastAPI + ML Model)
    2.1 Navigate to backend folder
        cd backend

    2.2 Create and activate a virtual environment
        python -m venv venv
    Windows
        venv\Scripts\activate
    macOS/Linux
        source venv/bin/activate

    2.3 Install backend dependencies
        pip install -r requirements.txt
    If requirements.txt is missing:
        pip install fastapi uvicorn numpy pandas scikit-learn joblib pillow opencv-python

    2.4 Train the body-fat ML model
        python train_bodyfat.py

    2.5 Start the backend server
        uvicorn main:app --reload --port 8000
    Backend will be available at:
        http://localhost:8000

3. Frontend Setup (React)
    3.1 Navigate to frontend folder
        cd frontend

    3.2 Install frontend dependencies
        npm install

    3.3 Configure environment variables
        Create a .env file in the frontend directory:
            REACT_APP_API_BASE=http://localhost:8000
            REACT_APP_SUPABASE_URL=YOUR_SUPABASE_URL
            REACT_APP_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
                Supabase credentials must be provided by the user to enable authentication and database features.

    3.4 Start the frontend
        npm start
    Frontend will run at:
        http://localhost:3000
        
4. Running the Application
    Once both servers are running:
    Open http://localhost:3000
    Register a new user account
    Log in
    Navigate to Analyzer
    Use Measurements (Recommended) for ML-based estimation
    Use Photo (Experimental) for heuristic image analysis
    Explore Goal Planner, Calculators, Workout Logger, and Progress Tracking

5. Important Notes for Graders
    Measurement-based analysis uses a Random Forest Regression model trained from CSV data
    Photo-based analysis is experimental and heuristic
    Uploaded images are processed in memory and are not stored
    All user data is stored securely in Supabase PostgreSQL

6. Common Errors
    “Bodyfat model is not loaded”
    You forgot to run:
        python train_bodyfat.py
            Frontend shows fetch/CORS errors
    Make sure:
        Backend is running on port 8000
    .env contains:
        REACT_APP_API_BASE=http://localhost:8000


REACT NOTES:
# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
