# TaskTracker - Daily Productivity Application

A full-stack daily productivity tracker built with React, Node.js, PostgreSQL, and modern web technologies.

## 🚀 Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Charts**: Chart.js with react-chartjs-2
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Toasts**: React Hot Toast
- **PDF Export**: jsPDF + html2canvas

## ✨ Features

- ✅ **User Authentication** - Register, Login, JWT-based protected routes
- ✅ **Dashboard** - Create, edit, delete tasks with daily completion tracking
- ✅ **Monthly Tracker** - Calendar-style grid to track task completion per day
- ✅ **Analytics** - Line charts, completion rates, streaks, task statistics
- ✅ **Heatmap** - GitHub-style contribution heatmap for the past year
- ✅ **Dark/Light/Navy Theme** - Toggle between three beautiful themes
- ✅ **Search Tasks** - Filter tasks by title
- ✅ **Data Export** - Export monthly reports as PDF or CSV
- ✅ **Responsive Design** - Mobile-friendly with sidebar navigation
- ✅ **PWA Support** - Install as a progressive web app
- ✅ **Toast Notifications** - User-friendly feedback for all actions

## 📁 Project Structure

```
├── client/                  # React Frontend
│   ├── public/
│   │   ├── manifest.json    # PWA manifest
│   │   └── vite.svg
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── TaskCard.jsx
│   │   ├── context/         # React Context providers
│   │   │   ├── AuthContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── hooks/           # Custom React hooks
│   │   │   └── useTasks.js
│   │   ├── layouts/         # Layout components
│   │   │   └── MainLayout.jsx
│   │   ├── pages/           # Page components
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MonthlyTracker.jsx
│   │   │   ├── Analytics.jsx
│   │   │   └── Heatmap.jsx
│   │   ├── services/        # API services
│   │   │   └── api.js
│   │   ├── utils/           # Utility functions
│   │   │   └── helpers.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json
│   └── package.json
│
├── server/                  # Express Backend
│   ├── config/
│   │   ├── database.js      # PostgreSQL connection
│   │   └── schema.sql       # Database schema
│   ├── controllers/
│   │   ├── authController.js
│   │   └── taskController.js
│   ├── middleware/
│   │   └── auth.js          # JWT verification
│   ├── models/
│   │   ├── User.js
│   │   ├── Task.js
│   │   └── TaskCompletion.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── tasks.js
│   ├── index.js             # Server entry point
│   ├── .env
│   └── package.json
│
├── .gitignore
└── README.md
```

## 🛠️ Local Development Setup

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### 1. Database Setup

```sql
-- Create the database
CREATE DATABASE productivity_tracker;

-- Run the schema
\c productivity_tracker
\i server/config/schema.sql
```

### 2. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Configure environment variables
cp .env .env.local
# Edit .env.local with your database credentials:
# DATABASE_URL=postgresql://user:password@localhost:5432/productivity_tracker
# JWT_SECRET=your_secret_key

# Start development server
npm run dev
```

The server will start on `http://localhost:5000`.

### 3. Frontend Setup

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start on `http://localhost:5173`.

### 4. Access the Application

Open your browser and navigate to `http://localhost:5173`

## 🚢 Deployment

### Frontend (Vercel)

1. Push the code to a GitHub repository
2. Go to [Vercel](https://vercel.com) and import your repository
3. Set the root directory to `client`
4. Configure build settings:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add environment variables:
   - `VITE_API_URL`: Your backend URL (e.g., `https://your-api.onrender.com/api`)
6. Deploy

### Backend (Render)

1. Go to [Render](https://render.com) and create a new Web Service
2. Connect your GitHub repository
3. Configure:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string
   - `JWT_SECRET`: A secure random string
   - `JWT_EXPIRES_IN`: `7d`
   - `NODE_ENV`: `production`
5. Deploy

### Database (Neon)

1. Go to [Neon](https://neon.tech) and create a PostgreSQL database
2. Get your connection string
3. Run the schema:
   ```bash
   psql "your-neon-connection-string" -f server/config/schema.sql
   ```

## 📊 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user (protected) |

### Tasks (All protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all tasks (supports `?search=`) |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |
| POST | `/api/tasks/:id/toggle` | Toggle today's completion |
| GET | `/api/tasks/monthly` | Get monthly tracker data |
| GET | `/api/tasks/analytics` | Get analytics data |
| GET | `/api/tasks/heatmap` | Get heatmap data |
| GET | `/api/tasks/export/csv` | Export data as CSV |

## 🎨 Theme Customization

The app supports three themes:
- **Light** - Clean white background
- **Dark** - Dark gray background
- **Navy** - Deep navy blue background

Toggle between themes using the button in the sidebar.

## 📝 License

MIT

---

Built with ❤️ using React, Node.js, and PostgreSQL