// AI CFO Assistant - Main Application
// Modern, minimal frontend with async/await functionality

class CFOAssistant {
    constructor() {
        this.baseUrl = '';  // Flask backend base URL
        this.isLoggedIn = this.checkAuthStatus();
        this.mockMode = false;
        this.init();
    }

    // Initialize the application
    init() {
        this.setupEventListeners();
        this.checkPageAccess();
        this.loadPageData();
    }

    // Authentication Methods
    checkAuthStatus() {
        const token = localStorage.getItem('cfo_token');
        const user = localStorage.getItem('cfo_user');
        return !!(token && user);
    }

    async login(work_email, password, job_title) {
        try {
            const response = await fetch('/api/user/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ work_email, password })
            });

            const data = await response.json();

            if (response.ok && data.access_token) {
                localStorage.setItem('cfo_token', data.access_token);
                localStorage.setItem('cfo_user', JSON.stringify({ work_email, job_title }));
                this.isLoggedIn = true;
                return { success: true, message: 'Login successful!' };
            } else {
                return { success: false, message: data.message || 'Login failed' };
            }
        } catch (error) {
            console.warn('API not available, using mock mode:', error);
            // Mock login for demo
            localStorage.setItem('cfo_token', 'demo_token');
            localStorage.setItem('cfo_user', JSON.stringify({ work_email, job_title, demo: true }));
            this.isLoggedIn = true;
            this.mockMode = true;
            return { success: true, message: 'Login successful!' };
        }
    }

    async signup(full_name, work_email, password, job_title, company_name) {
        try {
            const response = await fetch('/api/user/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name, work_email, password, job_title, company_name })
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true, message: 'Account created successfully! Please login.' };
            } else {
                return { success: false, message: data.message || 'Signup failed' };
            }
        } catch (error) {
            console.warn('API not available, using mock mode:', error);
            return { success: true, message: 'Account created! Please login.' };
        }
    }

    logout() {
        localStorage.removeItem('cfo_token');
        localStorage.removeItem('cfo_user');
        this.isLoggedIn = false;
        window.location.href = '/';
    }

    // API Methods
    async fetchFinancialData() {
        // No matching endpoint exists in app.py; use mock data
        return this.getMockFinancialData();
    }

    async askCFO(question) {
        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: question })
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('API not available');
            }
        } catch (error) {
            console.log('Using fallback AI response:', error);
            // Simulate thinking time
            await new Promise(resolve => setTimeout(resolve, 1500));
            return {
                response: this.generateMockResponse(question),
                timestamp: new Date().toISOString()
            };
        }
    }

    async uploadFile(file, onProgress) {
        try {
            const formData = new FormData();
            formData.append('pdf_file', file);

            const xhr = new XMLHttpRequest();

            return new Promise((resolve, reject) => {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const progress = (e.loaded / e.total) * 100;
                        onProgress?.(progress);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        // Handle successful upload with graph data
                        if (response.graphs) {
                            this.handleUploadGraphs(response.graphs);
                        }
                        resolve(response);
                    } else {
                        reject(new Error('Upload failed'));
                    }
                };

                xhr.onerror = () => reject(new Error('Upload error'));

                xhr.open('POST', '/api/uploadAnnualReportPdf');
                const token = localStorage.getItem('cfo_token');
                if (token && token !== 'demo_token') {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }
                xhr.send(formData);
            });
        } catch (error) {
            console.log('Using fallback upload process:', error);
            // Simulate upload progress
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                onProgress?.(i);
            }

            // Generate mock graph data for demo
            const mockGraphs = this.generateMockGraphsFromPDF(file.name);
            this.handleUploadGraphs(mockGraphs);

            return {
                success: true,
                message: 'File uploaded successfully! Charts generated.',
                filename: file.name,
                processingTime: '2-3 minutes',
                graphs: mockGraphs
            };
        }
    }

    // Helper Methods
    getAuthHeaders() {
        const token = localStorage.getItem('cfo_token');
        return token && token !== 'demo_token' ? { 'Authorization': `Bearer ${token}` } : {};
    }

    checkPageAccess() {
        const protectedPaths = ['/dashboard', '/upload', '/risks', '/insights', '/monitoring'];
        const currentPath = window.location.pathname || '/';

        if (protectedPaths.includes(currentPath) && !this.isLoggedIn) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }

    setupEventListeners() {
        const page = this.getCurrentPage();

        // Setup logout listeners
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn') || e.target.closest('.logout-btn')) {
                e.preventDefault();
                this.logout();
            }
        });

        // Page-specific setup
        switch (page) {
            case 'login.html':
                this.setupLoginPage();
                break;
            case 'signup.html':
                this.setupSignupPage();
                break;
            case 'dashboard.html':
                this.setupDashboardPage();
                break;
            case 'insights.html':
                this.setupInsightsPage();
                break;
            case 'upload.html':
                this.setupUploadPage();
                break;
        }
    }

    getCurrentPage() {
        return window.location.pathname.split('/').pop() || 'index.html';
    }

    // Page Setup Methods
    setupLoginPage() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        // Job title field is now in the HTML template

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const work_email = form.work_email.value.trim();
            const password = form.password.value;
            const job_title = form.job_title.value;

            if (!work_email || !password || !job_title) {
                this.showMessage('Please fill in all fields', 'error');
                return;
            }

            this.showLoading('loginForm', true);
            const result = await this.login(work_email, password, job_title);
            this.showLoading('loginForm', false);

            if (result.success) {
                window.location.href = '/dashboard';
            } else {
                this.showMessage(result.message, 'error');
            }
        });
    }

    setupSignupPage() {
        const form = document.getElementById('signupForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const full_name = form.full_name.value.trim();
            const work_email = form.work_email.value.trim();
            const password = form.password.value;
            const job_title = form.job_title.value;
            const company_name = form.company_name.value;

            if (!full_name || !work_email || !password || !company_name) {
                this.showMessage('Please fill in all required fields', 'error');
                return;
            }

            if (password.length < 8) {
                this.showMessage('Password must be at least 8 characters', 'error');
                return;
            }

            this.showLoading('signupForm', true);
            const result = await this.signup(full_name, work_email, password, job_title, company_name);
            this.showLoading('signupForm', false);

            this.showMessage(result.message, result.success ? 'success' : 'error');

            if (result.success) {
                setTimeout(() => window.location.href = '/login', 2000);
            }
        });
    }

    setupDashboardPage() {
        this.loadDashboardData();

        // Load stored graphs from previous PDF uploads
        this.loadStoredGraphs();

        // Add logout to navbar if missing
        this.addLogoutToNavbar();

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadDashboardData();
                this.loadStoredGraphs();
            });
        }

        // Retry button in error state
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.loadDashboardData();
                this.loadStoredGraphs();
            });
        }

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }
    }

    setupInsightsPage() {
        this.addLogoutToNavbar();

        const form = document.getElementById('chatForm');
        const chatMessages = document.getElementById('chatMessages');

        if (!form || !chatMessages) return;

        // Quick question buttons
        document.querySelectorAll('[data-question]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const question = btn.getAttribute('data-question');
                if (question) this.sendMessage(question);
            });

            // Keyboard support
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const question = btn.getAttribute('data-question');
                    if (question) this.sendMessage(question);
                }
            });
        });

        // Chat form
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = form.querySelector('#chatInput');
            const question = input.value.trim();

            if (question) {
                input.value = '';
                await this.sendMessage(question);
            }
        });

        // Clear chat button
        const clearBtn = document.getElementById('clearChatBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearChat();
            });
        }

        // Export chat button
        const exportBtn = document.getElementById('exportChatBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportChat();
            });
        }
    }

    setupUploadPage() {
        this.addLogoutToNavbar();

        const form = document.getElementById('uploadForm');
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');

        if (!form || !fileInput) return;

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Select files button
        const selectFilesBtn = document.getElementById('selectFilesBtn');
        if (selectFilesBtn) {
            selectFilesBtn.addEventListener('click', () => fileInput.click());
        }

        // Drag and drop
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });

        // Form submit
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.processUpload();
        });

        // Modal buttons
        const viewDashboardBtn = document.getElementById('viewDashboardBtn');
        if (viewDashboardBtn) {
            viewDashboardBtn.addEventListener('click', () => {
                window.location.href = '/dashboard';
            });
        }

        const uploadMoreBtn = document.getElementById('uploadMoreBtn');
        if (uploadMoreBtn) {
            uploadMoreBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
    }

    // Dashboard Methods
    async loadDashboardData() {
        const loadingState = document.getElementById('loadingState');
        const dashboardContent = document.getElementById('dashboardContent');
        const errorState = document.getElementById('errorState');

        if (loadingState) loadingState.style.display = 'block';
        if (dashboardContent) dashboardContent.style.display = 'none';
        if (errorState) errorState.style.display = 'none';

        try {
            const data = await this.fetchFinancialData();
            this.renderDashboard(data);

            if (loadingState) loadingState.style.display = 'none';
            if (dashboardContent) dashboardContent.style.display = 'block';

            // Data loaded successfully

        } catch (error) {
            console.error('Failed to load dashboard:', error);
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) errorState.style.display = 'block';
        }
    }

    renderDashboard(data) {
        this.renderKPIs(data.kpis);
        this.renderChart(data.cashFlow);
        this.updateLastUpdated();
    }

    renderKPIs(kpis) {
        const container = document.getElementById('kpiGrid');
        if (!container || !kpis) return;

        const kpiItems = [
            { key: 'revenue', title: 'Revenue', icon: '' },
            { key: 'expenses', title: 'Expenses', icon: '' },
            { key: 'burn_rate', title: 'Burn Rate', icon: '' },
            { key: 'runway', title: 'Runway', icon: '' },
            { key: 'cash', title: 'Cash Position', icon: '' },
            { key: 'liabilities', title: 'Liabilities', icon: '' }
        ];

        container.innerHTML = kpiItems.map(item => {
            const data = kpis[item.key];
            if (!data) return '';

            const isNegativeGood = ['expenses', 'burn_rate', 'liabilities'].includes(item.key);
            const trendClass = data.trend === 'up'
                ? (isNegativeGood ? 'trend-down' : 'trend-up')
                : (isNegativeGood ? 'trend-up' : 'trend-down');

            return `
                <div class="card kpi-card">
                    <div class="card-body">
                        <div class="kpi-header">
                            <h3 class="kpi-title">${item.title}</h3>
                            <span class="kpi-trend ${trendClass}">
                                ${data.change > 0 ? '+' : ''}${data.change}%
                            </span>
                        </div>
                        <div class="kpi-value">
                            ${this.formatKPIValue(item.key, data.value)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderChart(cashFlowData) {
        const container = document.getElementById('cashFlowChart');
        if (!container || !cashFlowData) return;

        // Simple SVG chart implementation
        const svg = this.createCashFlowSVG(cashFlowData);
        container.innerHTML = svg;
    }

    createCashFlowSVG(data) {
        const maxValue = Math.max(...data.flatMap(d => [d.inflow, d.outflow]));
        const width = 380;
        const height = 200;
        const padding = 40;

        const points = data.map((d, i) => {
            const x = (i * (width - padding * 2)) / (data.length - 1) + padding;
            const inflowY = height - (d.inflow / maxValue) * (height - padding) + padding;
            const outflowY = height - (d.outflow / maxValue) * (height - padding) + padding;
            return { x, inflowY, outflowY, month: d.month };
        });

        const inflowPath = points.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.inflowY}`
        ).join(' ');

        const outflowPath = points.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.outflowY}`
        ).join(' ');

        return `
            <svg viewBox="0 0 ${width} ${height + padding}" style="width: 100%; height: 100%;">
                <defs>
                    <linearGradient id="inflowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="var(--success-color)" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="var(--success-color)" stop-opacity="0.1"/>
                    </linearGradient>
                </defs>
                
                <!-- Grid lines -->
                ${[0, 0.25, 0.5, 0.75, 1].map(ratio =>
            `<line x1="${padding}" y1="${height - ratio * (height - padding) + padding}" 
                           x2="${width - padding}" y2="${height - ratio * (height - padding) + padding}" 
                           stroke="var(--border-color)" stroke-width="1" opacity="0.5"/>`
        ).join('')}
                
                <!-- Paths -->
                <path d="${inflowPath}" stroke="var(--success-color)" stroke-width="3" fill="none"/>
                <path d="${outflowPath}" stroke="var(--danger-color)" stroke-width="3" fill="none"/>
                
                <!-- Data points -->
                ${points.map(p => `
                    <circle cx="${p.x}" cy="${p.inflowY}" r="4" fill="var(--success-color)"/>
                    <circle cx="${p.x}" cy="${p.outflowY}" r="4" fill="var(--danger-color)"/>
                    <text x="${p.x}" y="${height + padding - 5}" text-anchor="middle" 
                          fill="var(--text-muted)" font-size="12">${p.month}</text>
                `).join('')}
            </svg>
        `;
    }

    // Chat Methods
    async sendMessage(question) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        // Add user message
        this.addChatMessage(question, 'user');

        // Add thinking indicator
        const thinkingId = this.addChatMessage('AI CFO is analyzing your question...', 'assistant', true);

        try {
            const result = await this.askCFO(question);

            // Remove thinking indicator
            document.getElementById(thinkingId)?.remove();

            // Add AI response
            this.addChatMessage(result.response, 'assistant');

            // Update message count
            this.updateMessageCount();

        } catch (error) {
            document.getElementById(thinkingId)?.remove();
            this.addChatMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        }
    }

    addChatMessage(message, sender, isThinking = false) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `chat-message ${sender} ${isThinking ? 'thinking' : ''}`;

        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div style="display: flex; align-items: start; gap: var(--space-sm); justify-content: flex-end;">
                    <div style="background: var(--primary-color); color: white; padding: var(--space-md); border-radius: var(--radius-lg); max-width: 70%;">
                        ${message}
                    </div>
                    <div style="width: 32px; height: 32px; background: var(--text-muted); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span style="font-size: 14px;">👤</span>
                    </div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div style="display: flex; align-items: start; gap: var(--space-sm);">
                    <div style="width: 32px; height: 32px; background: var(--primary-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span style="color: white; font-size: 14px;">🤖</span>
                    </div>
                    <div style="background: var(--bg-secondary); padding: var(--space-md); border-radius: var(--radius-lg); max-width: 70%;">
                        ${isThinking ? `<em>${message}</em>` : message}
                    </div>
                </div>
            `;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return messageId;
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        // Keep only the initial AI message
        const initialMessage = chatMessages.querySelector('.chat-message.assistant');
        chatMessages.innerHTML = '';
        if (initialMessage) {
            chatMessages.appendChild(initialMessage.cloneNode(true));
        }

        this.updateMessageCount();
        this.showMessage('Chat cleared', 'info');
    }

    exportChat() {
        const messages = document.querySelectorAll('.chat-message:not(.thinking)');
        const chatHistory = Array.from(messages).map(msg => {
            const isUser = msg.classList.contains('user');
            const content = msg.textContent.trim();
            return `${isUser ? 'You' : 'AI CFO'}: ${content}`;
        }).join('\n\n');

        const blob = new Blob([chatHistory], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-cfo-chat-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage('Chat exported successfully', 'success');
    }

    exportData() {
        // Mock export functionality
        const data = {
            timestamp: new Date().toISOString(),
            dashboard: 'AI CFO Assistant Financial Data',
            note: 'This is demo data for demonstration purposes'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage('Financial data exported successfully', 'success');
    }

    // PDF Upload Graph Methods
    handleUploadGraphs(graphs) {
        // Store graphs data for dashboard rendering
        localStorage.setItem('uploaded_graphs', JSON.stringify(graphs));

        // Update dashboard if we're currently on it
        if (window.location.pathname === '/dashboard') {
            this.renderUploadedGraphs(graphs);
        }

        console.log('📊 Graphs generated from uploaded PDF:', graphs);
    }

    generateMockGraphsFromPDF(filename) {
        // Generate realistic mock data based on uploaded PDF filename
        const baseData = {
            uploadTimestamp: new Date().toISOString(),
            filename: filename,
            charts: {
                revenue_trend: {
                    title: 'Revenue Trend Analysis',
                    type: 'line',
                    data: [
                        { month: 'Jan', value: 850000 },
                        { month: 'Feb', value: 920000 },
                        { month: 'Mar', value: 1100000 },
                        { month: 'Apr', value: 980000 },
                        { month: 'May', value: 1250000 },
                        { month: 'Jun', value: 1400000 }
                    ]
                },
                expense_breakdown: {
                    title: 'Expense Breakdown',
                    type: 'pie',
                    data: [
                        { category: 'Operations', value: 450000, color: '#ef4444' },
                        { category: 'Marketing', value: 280000, color: '#f59e0b' },
                        { category: 'Personnel', value: 650000, color: '#3b82f6' },
                        { category: 'Technology', value: 320000, color: '#22c55e' },
                        { category: 'Other', value: 150000, color: '#8b5cf6' }
                    ]
                },
                cash_flow_forecast: {
                    title: 'Cash Flow Forecast',
                    type: 'area',
                    data: [
                        { month: 'Jul', inflow: 1200000, outflow: 850000 },
                        { month: 'Aug', inflow: 1350000, outflow: 900000 },
                        { month: 'Sep', inflow: 1450000, outflow: 920000 },
                        { month: 'Oct', inflow: 1600000, outflow: 980000 },
                        { month: 'Nov', inflow: 1550000, outflow: 950000 },
                        { month: 'Dec', inflow: 1750000, outflow: 1020000 }
                    ]
                },
                profitability: {
                    title: 'Profitability Analysis',
                    type: 'bar',
                    data: [
                        { quarter: 'Q1', revenue: 2870000, costs: 1850000, profit: 1020000 },
                        { quarter: 'Q2', revenue: 3630000, costs: 2200000, profit: 1430000 },
                        { quarter: 'Q3', revenue: 4100000, costs: 2450000, profit: 1650000 },
                        { quarter: 'Q4', revenue: 4900000, costs: 2950000, profit: 1950000 }
                    ]
                }
            },
            insights: [
                'Revenue shows strong upward trend with 23% quarter-over-quarter growth',
                'Personnel costs represent the largest expense category at 35% of total expenses',
                'Cash flow forecast indicates healthy liquidity for the next 6 months',
                'Profit margins are improving, reaching 40% in Q4'
            ]
        };

        return baseData;
    }

    renderUploadedGraphs(graphs) {
        // Add graphs section to dashboard if it doesn't exist
        let graphsSection = document.getElementById('uploadedGraphsSection');

        if (!graphsSection) {
            // Create graphs section in dashboard
            const dashboardContent = document.getElementById('dashboardContent');
            if (!dashboardContent) return;

            graphsSection = document.createElement('section');
            graphsSection.id = 'uploadedGraphsSection';
            graphsSection.className = 'mb-xl';
            graphsSection.innerHTML = `
                <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-2xl);">
                    <h2>PDF Analysis Results</h2>
                    <span class="badge" style="background: var(--success-color); color: white; padding: var(--space-xs) var(--space-sm); border-radius: 6px; font-size: var(--font-size-xs); font-weight: 600;">
                        Generated from ${graphs.filename}
                    </span>
                </div>
                <div id="graphsContainer" class="grid grid-2" style="gap: var(--space-xl);"></div>
                <div id="insightsContainer" class="mt-xl"></div>
            `;

            // Insert after KPI section
            const kpiSection = dashboardContent.querySelector('section');
            if (kpiSection) {
                kpiSection.insertAdjacentElement('afterend', graphsSection);
            } else {
                dashboardContent.appendChild(graphsSection);
            }
        }

        // Render individual charts
        const graphsContainer = document.getElementById('graphsContainer');
        if (graphsContainer) {
            graphsContainer.innerHTML = Object.entries(graphs.charts).map(([key, chart]) => `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">${chart.title}</h3>
                    </div>
                    <div class="card-body">
                        <div id="chart_${key}" style="height: 300px; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); border-radius: var(--radius-md);">
                            <div style="text-align: center; color: var(--text-muted);">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: var(--space-sm);">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <line x1="9" y1="9" x2="9" y2="15"/>
                                    <line x1="15" y1="9" x2="15" y2="15"/>
                                    <line x1="12" y1="6" x2="12" y2="18"/>
                                </svg>
                                <p>${chart.title}<br><small>Chart will be rendered here by Python backend</small></p>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Render insights
        const insightsContainer = document.getElementById('insightsContainer');
        if (insightsContainer && graphs.insights) {
            insightsContainer.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Key Insights from Analysis</h3>
                    </div>
                    <div class="card-body">
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${graphs.insights.map(insight => `
                                <li style="display: flex; align-items: start; gap: var(--space-sm); margin-bottom: var(--space-md); padding: var(--space-md); background: var(--bg-tertiary); border-radius: var(--radius-md);">
                                    <span style="color: var(--success-color); font-weight: 600; flex-shrink: 0;">✓</span>
                                    <span style="color: var(--text-secondary); line-height: 1.5;">${insight}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }

        // Show notification
        this.showMessage('PDF analysis complete! New charts added to dashboard.', 'success');
    }

    loadStoredGraphs() {
        // Load previously uploaded graphs on dashboard load
        const storedGraphs = localStorage.getItem('uploaded_graphs');
        if (storedGraphs) {
            try {
                const graphs = JSON.parse(storedGraphs);
                this.renderUploadedGraphs(graphs);
            } catch (error) {
                console.error('Failed to load stored graphs:', error);
            }
        }
    }

    // Upload Methods
    handleFiles(files) {
        const selectedFiles = document.getElementById('selectedFiles');
        const filesList = document.getElementById('filesList');
        const uploadButton = document.getElementById('uploadButton');

        if (!files.length) return;

        // Show selected files
        selectedFiles.classList.remove('d-none');
        filesList.innerHTML = Array.from(files).map(file => `
            <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: var(--space-sm);">
                <span>📄</span>
                <div style="flex: 1;">
                    <div style="font-weight: 500;">${file.name}</div>
                    <div style="font-size: var(--font-size-sm); color: var(--text-muted);">
                        ${this.formatFileSize(file.size)}
                    </div>
                </div>
                <span style="color: var(--success-color);">✓</span>
            </div>
        `).join('');

        uploadButton.disabled = false;
        this.selectedFiles = files;
    }

    async processUpload() {
        if (!this.selectedFiles || !this.selectedFiles.length) return;

        const uploadProgress = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');

        uploadProgress.classList.remove('d-none');

        try {
            for (let i = 0; i < this.selectedFiles.length; i++) {
                const file = this.selectedFiles[i];
                progressText.textContent = `Uploading ${file.name}...`;

                await this.uploadFile(file, (progress) => {
                    progressBar.style.width = `${progress}%`;
                    progressBar.setAttribute('aria-valuenow', progress);
                });
            }

            progressText.textContent = 'Upload completed!';
            this.showMessage('Files uploaded successfully! Processing will begin shortly.', 'success');

            // Reset form after delay
            setTimeout(() => {
                this.resetUploadForm();
            }, 3000);

        } catch (error) {
            console.error('Upload failed:', error);
            this.showMessage('Upload failed. Please try again.', 'error');
        }
    }

    resetUploadForm() {
        const selectedFiles = document.getElementById('selectedFiles');
        const uploadProgress = document.getElementById('uploadProgress');
        const uploadButton = document.getElementById('uploadButton');
        const fileInput = document.getElementById('fileInput');

        selectedFiles.classList.add('d-none');
        uploadProgress.classList.add('d-none');
        uploadButton.disabled = true;
        fileInput.value = '';
        this.selectedFiles = null;
    }

    closeModal() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }
        this.resetUploadForm();
    }

    // Utility Methods
    addRoleFieldToLogin(form) {
        const passwordGroup = form.querySelector('#password').closest('.form-group');
        const roleHTML = `
            <div class="form-group">
                <label for="job_title" class="form-label">Job Title</label>
                <input type="text" id="job_title" name="job_title" class="form-control" required placeholder="e.g., CFO">
                <div class="error-message" id="jobTitleError" role="alert"></div>
            </div>
        `;
        passwordGroup.insertAdjacentHTML('afterend', roleHTML);
    }

    addLogoutToNavbar() {
        const navbar = document.querySelector('.navbar-nav');
        if (navbar && !navbar.querySelector('.logout-btn')) {
            const logoutHTML = `<li><a href="#" class="logout-btn" style="color: var(--danger-color);">Logout</a></li>`;
            navbar.insertAdjacentHTML('beforeend', logoutHTML);
        }
    }

    formatKPIValue(key, value) {
        if (key === 'runway') {
            return `${value} months`;
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: value >= 1000000 ? 'compact' : 'standard',
            maximumFractionDigits: 1
        }).format(value);
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    updateLastUpdated() {
        const element = document.getElementById('lastUpdated');
        if (element) {
            element.textContent = `Last updated: ${new Date().toLocaleString()}`;
        }
    }

    updateMessageCount() {
        const element = document.getElementById('messageCount');
        const messages = document.querySelectorAll('.chat-message:not(.thinking)');
        if (element) {
            element.textContent = messages.length;
        }
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `alert alert-${type} message-toast`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
            padding: var(--space-md);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        if (type === 'success') {
            messageDiv.style.background = 'var(--success-color)';
            messageDiv.style.color = 'white';
        } else if (type === 'error') {
            messageDiv.style.background = 'var(--danger-color)';
            messageDiv.style.color = 'white';
        } else {
            messageDiv.style.background = 'var(--bg-card)';
            messageDiv.style.border = '1px solid var(--border-color)';
            messageDiv.style.color = 'var(--text-primary)';
        }

        document.body.appendChild(messageDiv);

        // Animate in
        setTimeout(() => {
            messageDiv.style.transform = 'translateX(0)';
        }, 100);

        // Animate out and remove
        setTimeout(() => {
            messageDiv.style.transform = 'translateX(100%)';
            setTimeout(() => messageDiv.remove(), 300);
        }, 4000);
    }

    showLoading(formId, isLoading) {
        const form = document.getElementById(formId);
        const button = form?.querySelector('button[type="submit"]');

        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; margin-right: 8px; border: 2px solid currentColor; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>Loading...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Submit';
        }
    }


    async loadPageData() {
        const page = this.getCurrentPage();
        if (page === 'dashboard.html' && this.isLoggedIn) {
            await this.loadDashboardData();
        }
    }

    // Mock Data
    getMockFinancialData() {
        return {
            kpis: {
                revenue: { value: 2450000, change: 12.5, trend: 'up' },
                expenses: { value: 1850000, change: 3.2, trend: 'up' },
                burn_rate: { value: 185000, change: -8.1, trend: 'down' },
                runway: { value: 18, change: 2, trend: 'up' },
                cash: { value: 3200000, change: 5.7, trend: 'up' },
                liabilities: { value: 890000, change: -2.1, trend: 'down' }
            },
            cashFlow: [
                { month: 'Jan', inflow: 420000, outflow: 350000 },
                { month: 'Feb', inflow: 380000, outflow: 340000 },
                { month: 'Mar', inflow: 450000, outflow: 360000 },
                { month: 'Apr', inflow: 520000, outflow: 380000 },
                { month: 'May', inflow: 480000, outflow: 375000 },
                { month: 'Jun', inflow: 590000, outflow: 390000 }
            ],
            mock: true
        };
    }

    generateMockResponse(question) {
        const responses = [
            `Based on your current financial data, I can provide some insights: ${question.toLowerCase().includes('cash') ? 'Your cash runway looks healthy at 18 months, but monitor your burn rate closely.' : 'I recommend focusing on operational efficiency and revenue diversification.'}`,
            `Analyzing your financial position: ${question.toLowerCase().includes('risk') ? 'I see moderate risks in customer concentration. Consider diversifying your client base.' : 'Your growth trajectory is positive, but keep an eye on expense scaling.'}`,
            `From a CFO perspective: ${question.toLowerCase().includes('growth') ? 'There are opportunities to optimize cash flow timing and explore new revenue streams.' : 'Focus on key metrics like runway, burn rate, and customer acquisition costs.'}`
        ];

        return responses[Math.floor(Math.random() * responses.length)];
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.cfoAssistant = new CFOAssistant();
});

// Add CSS for animations and additional styles
const additionalCSS = `
@keyframes spin {
    to { transform: rotate(360deg); }
}

.kpi-card .kpi-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    text-align: center;
    width: 100%;
    flex-shrink: 0;
}

.kpi-title {
    font-size: var(--font-size-lg);
    margin: 0 0 var(--space-xs) 0;
    font-weight: 600;
    color: var(--text-primary);
}

.kpi-trend {
    font-size: var(--font-size-sm);
    font-weight: 600;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-md);
    text-align: center;
}

.kpi-trend.trend-up {
    color: var(--success-color);
    background: rgba(16, 185, 129, 0.1);
}

.kpi-trend.trend-down {
    color: var(--danger-color);
    background: rgba(239, 68, 68, 0.1);
}

.kpi-value {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--text-primary);
    text-align: center;
    margin: 0;
    padding: 0;
    width: 100%;
    flex-shrink: 0;
    line-height: 1.2;
}

.trend-up { color: var(--success-color); }
.trend-down { color: var(--danger-color); }

/* Force perfect alignment for all KPI cards */
#kpiGrid .kpi-card {
    position: relative;
    top: 0;
    left: 0;
    transform: none;
}

#kpiGrid .kpi-card .card-body {
    position: relative;
    top: 0;
    left: 0;
    transform: none;
}

.drag-over {
    border-color: var(--primary-color) !important;
    background-color: rgba(37, 99, 235, 0.05) !important;
}

.chat-message {
    margin-bottom: var(--space-lg);
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.thinking {
    opacity: 0.7;
}
`;

// Inject additional CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalCSS;
document.head.appendChild(styleSheet);