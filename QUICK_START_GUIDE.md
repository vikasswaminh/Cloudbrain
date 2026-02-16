# 🚀 CloudBrain Quick Start Guide

**Updated:** 2026-02-16 23:58 IST
**Status:** ✅ All systems operational

---

## 🌐 Access URLs

### **Production Deployment:**
- **Backend API:** https://api.coding.super25.ai
- **Frontend (Pages):** https://2f6c8911.coding-brain-frontend.pages.dev
- **Admin Dashboard:** https://2f6c8911.coding-brain-frontend.pages.dev/admin/dashboard

### **Local Development:**
- **Frontend Dev Server:** http://localhost:5173
- **Backend:** Uses production API (https://api.coding.super25.ai)

---

## 🔧 Setup Instructions

### **For Local Development:**

1. **Start Frontend Dev Server:**
```bash
cd coding-brain-frontend
npm run dev
```
Open http://localhost:5173 in your browser.

2. **Environment Configuration:**
The frontend is already configured with `.env.local`:
```
VITE_API_URL=https://api.coding.super25.ai
```

3. **Create Admin User (if needed):**
```bash
curl -X POST https://api.coding.super25.ai/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "role": "admin"
  }'
```

4. **Login:**
- Go to http://localhost:5173/login
- Enter your admin credentials
- Click "Analytics" in sidebar to access dashboard

---

## 📊 Admin Dashboard Features

### **What You Can Monitor:**

1. **Summary Cards:**
   - Total Users
   - Executions Today
   - Success Rate (24h)
   - System Health

2. **Success Rate Bar:**
   - Visual progress bar showing execution success %
   - Color-coded: Green (≥80%), Yellow (60-79%), Red (<60%)

3. **Model Usage Chart:**
   - Pie chart showing AI model distribution
   - Interactive tooltips with exact counts

4. **CLI Agent Statistics:**
   - Total sessions (24h)
   - Commands executed
   - Command success rate

5. **Telemetry Heatmap:**
   - Top FSM state transitions
   - Aborted sessions warning

6. **Token Usage:**
   - Total tokens consumed (input/output)
   - Top 5 users by consumption

7. **Recent Executions Stream:**
   - Last 20 executions
   - Real-time status (running/completed/failed)
   - User emails and timestamps

8. **System Health Checks:**
   - D1 Database
   - R2 Bucket
   - AI Binding
   - Durable Objects
   - Execution Queue
   - Error Rate

9. **Error Log:**
   - Last hour failures
   - Event types and timestamps

---

## 🔒 Security & Access

### **Dashboard Access:**
- Only users with `role: 'admin'` can access
- Regular users (viewer/developer) won't see Analytics link
- Protected by JWT authentication
- 401 for unauthenticated requests
- 403 for non-admin users

### **API Authentication:**
All admin dashboard endpoints require:
```
Authorization: Bearer {jwt_token}
```

Get token by logging in:
```bash
curl -X POST https://api.coding.super25.ai/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!"
  }'
```

---

## 🛠️ Troubleshooting

### **Issue: Login fails / Can't access dashboard**

**Solution 1: Verify your user is admin**
```bash
# Check your user role in the database (contact admin)
```

**Solution 2: Clear browser storage and re-login**
1. Open browser DevTools (F12)
2. Go to Application tab
3. Clear Local Storage
4. Refresh page and login again

---

### **Issue: Dashboard shows "No data"**

**Reason:** System is new, no executions yet

**Solution:** Generate some test data:
```bash
# Create a test execution via API
curl -X POST https://api.coding.super25.ai/plan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task": "Create a hello world script"}'
```

---

### **Issue: Charts not rendering**

**Reason:** Recharts bundle may not have loaded

**Solution:**
1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Check browser console for errors
3. Verify network requests are succeeding

---

### **Issue: "ERR_CONNECTION_REFUSED" errors**

**Fixed!** ✅

The frontend is now configured to use the production API:
- `.env.production` sets `VITE_API_URL=https://api.coding.super25.ai`
- `.env.local` does the same for local development
- No need to run backend locally

---

## 📈 Monitoring Best Practices

### **Daily Checks:**
1. ✅ Success rate should be ≥80%
2. ✅ System health should be all green
3. ✅ No error spikes in error log

### **Weekly Reviews:**
1. 📊 Token usage trends (cost monitoring)
2. 👥 Top users by consumption
3. 🐛 FSM telemetry patterns (dropoff analysis)
4. 🔧 Error patterns (debugging)

### **Monthly Reports:**
1. 📈 User growth
2. 💰 Cost per user/model
3. 🚀 Performance trends
4. 🎯 Success rate improvements

---

## 🎯 API Endpoints Reference

### **Dashboard Stats:**
```bash
GET https://api.coding.super25.ai/admin/dashboard/stats
Authorization: Bearer {token}
```

### **System Health:**
```bash
GET https://api.coding.super25.ai/admin/dashboard/health
Authorization: Bearer {token}
```

### **Telemetry Analytics:**
```bash
GET https://api.coding.super25.ai/admin/dashboard/telemetry
Authorization: Bearer {token}
```

### **Usage Tracking:**
```bash
GET https://api.coding.super25.ai/admin/dashboard/usage
Authorization: Bearer {token}
```

---

## 📚 Documentation Reference

For detailed information, see:

1. **[CLOUDBRAIN_ARCHITECTURE_ANALYSIS.md](./CLOUDBRAIN_ARCHITECTURE_ANALYSIS.md)**
   - Complete code review (500+ lines)
   - All API endpoints documented
   - Security architecture

2. **[ADMIN_DASHBOARD_DESIGN.md](./ADMIN_DASHBOARD_DESIGN.md)**
   - Dashboard design specification (400+ lines)
   - Implementation details
   - Chart configurations

3. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)**
   - Deployment guide (300+ lines)
   - Testing checklist
   - Success metrics

4. **[DASHBOARD_DEPLOYMENT_SUCCESS.md](./DASHBOARD_DEPLOYMENT_SUCCESS.md)**
   - Deployment status report (500+ lines)
   - Performance metrics
   - Troubleshooting tips

---

## 🎊 Summary

**Your CloudBrain platform is fully operational with:**

✅ **Backend:** 4 dashboard API endpoints deployed to Workers
✅ **Frontend:** Admin dashboard with 8 monitoring panels on Pages
✅ **Database:** Sessions table for telemetry persistence
✅ **Documentation:** 1,200+ lines of comprehensive docs
✅ **Security:** Role-based access control (admin-only)
✅ **Real-time:** Auto-refresh every 10 seconds

**Access your dashboard:**
1. Go to https://2f6c8911.coding-brain-frontend.pages.dev
2. Login with admin credentials
3. Click "Analytics" in sidebar
4. Monitor your entire CloudBrain platform! 🎉

---

**Questions?** Check the troubleshooting section above or review the comprehensive documentation.

**Status:** 🟢 **ALL SYSTEMS OPERATIONAL**
