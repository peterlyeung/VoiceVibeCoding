import { LightningElement, wire } from 'lwc';
import getOpportunities from '@salesforce/apex/OpportunityController.getOpportunities';
import getContactsForAccount from '@salesforce/apex/OpportunityController.getContactsForAccount';

export default class OpportunityBubbleChart extends LightningElement {
    opportunities = [];
    isLoading = true;
    hasError = false;
    errorMessage = '';
    totalCount = 0;
    chartData = [];
    selectedOpportunity = null;
    showModal = false;
    canvasPoints = []; // Store canvas coordinates for click detection
    selectedAccountId = ''; // Empty = All Accounts
    accountColorMap = {}; // Persistent color mapping for all accounts
    contacts = [];
    showContacts = false;
    isLoadingContacts = false;
    suggestedContact = null;

    @wire(getOpportunities)
    wiredOpportunities({ error, data }) {
        console.log('wiredOpportunities called', { error, data, dataLength: data?.length });
        this.isLoading = false;
        if (data) {
            console.log('Processing', data.length, 'opportunities');
            this.opportunities = data.map(opp => ({
                Id: opp.Id,
                Name: opp.Name,
                Amount: opp.Amount || 0,
                FormattedAmount: opp.Amount ? `$${opp.Amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00',
                StageName: opp.StageName,
                CloseDate: opp.CloseDate,
                AccountName: opp.Account ? opp.Account.Name : 'N/A',
                AccountId: opp.Account ? opp.Account.Id : null,
                OwnerName: opp.Owner ? opp.Owner.Name : 'N/A',
                Url: `/${opp.Id}`
            }));
            this.totalCount = data.length;
            this.hasError = false;
            
            // Prepare chart data - filter out invalid data
            this.chartData = this.opportunities
                .filter(opp => opp.CloseDate && opp.Amount != null && opp.Amount > 0)
                .map(opp => ({
                    x: new Date(opp.CloseDate).getTime(),
                    y: opp.Amount,
                    name: opp.Name,
                    id: opp.Id,
                    accountId: opp.AccountId,
                    accountName: opp.AccountName,
                    opportunity: opp
                }));
            
            console.log('Chart data prepared:', this.chartData.length, 'points');
            
            // Generate persistent color mapping for all accounts
            const uniqueAccounts = [...new Set(this.chartData.map(p => p.accountId || '__NA__'))];
            const accountColors = this.generateAccountColors(uniqueAccounts.length);
            this.accountColorMap = {};
            uniqueAccounts.forEach((accountId, index) => {
                this.accountColorMap[accountId] = accountColors[index];
            });
            console.log('Color mapping generated for', uniqueAccounts.length, 'accounts');
            
            // Draw chart after a short delay
            setTimeout(() => {
                this.drawBubbleChart();
            }, 1000);
        } else if (error) {
            console.error('Error loading opportunities:', error);
            this.hasError = true;
            this.errorMessage = error.body ? error.body.message : 'Unknown error occurred';
        } else {
            console.log('No data and no error - still loading?');
        }
    }

    get hasOpportunities() {
        return this.opportunities && this.opportunities.length > 0;
    }
    
    // Unique accounts from chart data for the picklist
    get accountOptions() {
        if (!this.chartData || this.chartData.length === 0) {
            return [{ label: 'All Accounts', value: '' }];
        }
        const seen = new Set();
        const options = [{ label: 'All Accounts', value: '' }];
        this.chartData.forEach(p => {
            const id = p.accountId || '__NA__';
            const name = p.accountName || 'N/A';
            if (!seen.has(id)) {
                seen.add(id);
                options.push({ label: name, value: id });
            }
        });
        return options;
    }
    
    // Chart data filtered by selected account
    get filteredChartData() {
        if (!this.chartData) return [];
        if (!this.selectedAccountId) return this.chartData;
        return this.chartData.filter(p => (p.accountId || '__NA__') === this.selectedAccountId);
    }
    
    handleAccountChange(event) {
        this.selectedAccountId = event.detail.value || '';
        setTimeout(() => this.drawBubbleChart(), 50);
    }

    renderedCallback() {
        // Draw chart when DOM is ready
        if (this.hasOpportunities && this.chartData.length > 0) {
            setTimeout(() => {
                this.drawBubbleChart();
            }, 500);
        }
    }

    drawBubbleChart() {
        const container = this.template.querySelector('.chart-container');
        if (!container) {
            console.error('Chart container not found');
            return;
        }
        
        const canvas = container.querySelector('canvas.chart-canvas');
        if (!canvas) {
            console.error('Canvas not found');
            return;
        }
        
        const dataToPlot = this.filteredChartData;
        if (dataToPlot.length === 0) {
            console.log('No chart data available for selected account');
            return;
        }

        console.log('Drawing bubble chart with', dataToPlot.length, 'data points');
        
        // Get container dimensions
        const containerRect = container.getBoundingClientRect();
        const width = Math.floor(containerRect.width) || 800;
        const height = 500;
        
        // Set canvas size (must match display size for crisp rendering)
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');

        // Clear canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // Chart area with padding
        const padding = { left: 80, right: 40, top: 40, bottom: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // Find min/max values from filtered data
        const dates = dataToPlot.map(d => d.x);
        const amounts = dataToPlot.map(d => d.y);
        const minDate = Math.min(...dates);
        const maxDate = Math.max(...dates);
        const dateRange = Math.max(maxDate - minDate, 1); // Avoid division by zero
        const minAmount = 0;
        const maxAmount = Math.max(...amounts) * 1.1; // Add 10% padding on top
        const amountRange = Math.max(maxAmount - minAmount, 1); // Avoid division by zero
        
        // Draw axes
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        
        // Y-axis (Amount)
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.stroke();
        
        // X-axis (Date)
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top + chartHeight);
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.stroke();
        
        // Draw axis labels
        ctx.fillStyle = '#333333';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Close Date', width / 2, height - 10);
        
        ctx.save();
        ctx.translate(25, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Opportunity Amount ($)', 0, 0);
        ctx.restore();
        
        // Draw Y-axis labels (amounts)
        ctx.textAlign = 'right';
        ctx.font = '12px Arial';
        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const amount = minAmount + (maxAmount - minAmount) * (i / ySteps);
            const y = padding.top + chartHeight - (i / ySteps) * chartHeight;
            ctx.fillText('$' + Math.round(amount).toLocaleString(), padding.left - 10, y + 4);
        }
        
        // Draw X-axis labels (dates)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const xSteps = 6;
        for (let i = 0; i <= xSteps; i++) {
            const date = minDate + (maxDate - minDate) * (i / xSteps);
            const x = padding.left + (i / xSteps) * chartWidth;
            const dateObj = new Date(date);
            const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            ctx.fillText(label, x, padding.top + chartHeight + 10);
        }
        
        // Draw grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= ySteps; i++) {
            const y = padding.top + chartHeight - (i / ySteps) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
        
        // Vertical grid lines
        for (let i = 0; i <= xSteps; i++) {
            const x = padding.left + (i / xSteps) * chartWidth;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        }
        
        // Draw bubbles - size based on amount, color based on account
        const minBubbleSize = 5;
        const maxBubbleSize = 30;
        const minAmountForSize = Math.min(...amounts);
        const maxAmountForSize = Math.max(...amounts);
        const amountSizeRange = Math.max(maxAmountForSize - minAmountForSize, 1);
        
        // Clear previous points
        this.canvasPoints = [];
        
        dataToPlot.forEach(point => {
            const x = padding.left + ((point.x - minDate) / dateRange) * chartWidth;
            const y = padding.top + chartHeight - ((point.y - minAmount) / amountRange) * chartHeight;
            
            // Calculate bubble size based on amount
            const normalizedAmount = (point.y - minAmountForSize) / amountSizeRange;
            const bubbleSize = minBubbleSize + (maxBubbleSize - minBubbleSize) * normalizedAmount;
            
            // Get color for this account from persistent mapping
            const accountKey = point.accountId || '__NA__';
            const accountColor = this.accountColorMap[accountKey] || '#0070d2';
            
            // Store point coordinates for click detection
            this.canvasPoints.push({
                x: x,
                y: y,
                radius: bubbleSize,
                point: point
            });
            
            // Convert hex color to rgba for gradient
            const rgb = this.hexToRgb(accountColor);
            const rgbaLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
            const rgbaDark = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
            
            // Draw bubble with gradient using account color
            const gradient = ctx.createRadialGradient(x - bubbleSize * 0.3, y - bubbleSize * 0.3, 0, x, y, bubbleSize);
            gradient.addColorStop(0, rgbaLight);
            gradient.addColorStop(1, rgbaDark);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, bubbleSize, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw border with account color
            ctx.strokeStyle = accountColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        });
        
        // Add click event listener
        this.setupCanvasClick(canvas);
        
        console.log('Bubble chart drawn successfully with', dataToPlot.length, 'points');
    }
    
    setupCanvasClick(canvas) {
        // Remove existing listener if any
        if (canvas._clickHandler) {
            canvas.removeEventListener('click', canvas._clickHandler);
        }
        
        // Create new click handler
        canvas._clickHandler = (event) => {
            console.log('Canvas clicked!');
            const rect = canvas.getBoundingClientRect();
            
            // Scale click coordinates based on canvas display size vs actual drawing size
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const clickX = (event.clientX - rect.left) * scaleX;
            const clickY = (event.clientY - rect.top) * scaleY;
            
            console.log('Click coordinates:', clickX, clickY);
            console.log('Canvas points:', this.canvasPoints.length);

            // Find the closest point
            let closestPoint = null;
            let minDistance = Infinity;
            
            this.canvasPoints.forEach(canvasPoint => {
                const distance = Math.sqrt(
                    Math.pow(clickX - canvasPoint.x, 2) + 
                    Math.pow(clickY - canvasPoint.y, 2)
                );
                
                // Check if click is within the bubble (with some tolerance)
                if (distance <= canvasPoint.radius + 10 && distance < minDistance) {
                    minDistance = distance;
                    closestPoint = canvasPoint.point;
                }
            });
            
            if (closestPoint) {
                console.log('Closest point found:', closestPoint);
                // Find the full opportunity object
                const opportunity = this.opportunities.find(opp => opp.Id === closestPoint.id);
                if (opportunity) {
                    this.selectedOpportunity = opportunity;
                    this.showModal = true;
                    console.log('Modal should be showing now');
                }
            } else {
                console.log('No closest point found.');
            }
        };
        
        canvas.addEventListener('click', canvas._clickHandler);
        canvas.style.cursor = 'pointer';
    }
    
    closeModal() {
        this.showModal = false;
        this.selectedOpportunity = null;
        this.showContacts = false;
        this.contacts = [];
        this.suggestedContact = null;
    }
    
    async handleShowContacts() {
        if (!this.selectedOpportunity || !this.selectedOpportunity.AccountId) {
            console.error('No account ID available');
            return;
        }
        
        this.isLoadingContacts = true;
        this.showContacts = true;
        
        try {
            const contactList = await getContactsForAccount({ accountId: this.selectedOpportunity.AccountId });
            this.contacts = contactList.map(contact => ({
                Id: contact.Id,
                Name: contact.Name,
                Email: contact.Email || 'N/A',
                Phone: contact.Phone || 'N/A',
                Title: contact.Title || 'N/A',
                LastActivityDate: contact.LastActivityDate,
                CreatedDate: contact.CreatedDate
            }));
            
            // Determine suggested contact
            this.determineSuggestedContact();
            
            // Mark suggested contact in the list
            if (this.suggestedContact) {
                this.contacts = this.contacts.map(contact => ({
                    ...contact,
                    suggestedClass: contact.Id === this.suggestedContact.Id ? 'slds-theme_success' : ''
                }));
            }
            
            this.isLoadingContacts = false;
        } catch (error) {
            console.error('Error loading contacts:', error);
            this.isLoadingContacts = false;
            this.contacts = [];
            this.suggestedContact = null;
        }
    }
    
    determineSuggestedContact() {
        if (!this.contacts || this.contacts.length === 0) {
            this.suggestedContact = null;
            return;
        }
        
        // Suggest based on priority: Recent Activity > Most Recent
        // First, try contacts with recent activity
        const withActivity = this.contacts.filter(c => c.LastActivityDate);
        if (withActivity.length > 0) {
            this.suggestedContact = withActivity.sort((a, b) => 
                new Date(b.LastActivityDate) - new Date(a.LastActivityDate)
            )[0];
            return;
        }
        
        // Finally, most recently created
        this.suggestedContact = this.contacts.sort((a, b) => 
            new Date(b.CreatedDate) - new Date(a.CreatedDate)
        )[0];
    }
    
    get suggestedContactReason() {
        if (!this.suggestedContact) return '';
        
        if (this.suggestedContact.LastActivityDate) {
            return 'Most recent activity';
        }
        return 'Most recently added contact';
    }
    
    get formattedAmount() {
        if (!this.selectedOpportunity || !this.selectedOpportunity.Amount) {
            return '$0.00';
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(this.selectedOpportunity.Amount);
    }
    
    get formattedCloseDate() {
        if (!this.selectedOpportunity || !this.selectedOpportunity.CloseDate) {
            return 'N/A';
        }
        const date = new Date(this.selectedOpportunity.CloseDate);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
    }
    
    generateAccountColors(count) {
        // Generate distinct colors for different accounts
        const colors = [
            '#0070d2', // Salesforce blue
            '#1589ee', // Light blue
            '#ff6b35', // Orange
            '#4bc076', // Green
            '#ffb75d', // Yellow
            '#b070d2', // Purple
            '#d2504c', // Red
            '#00a1e0', // Cyan
            '#f39e58', // Orange
            '#2e844a', // Dark green
            '#c23934', // Dark red
            '#8b5cf6'  // Violet
        ];
        
        // If we need more colors, generate them
        const result = [];
        for (let i = 0; i < count; i++) {
            if (i < colors.length) {
                result.push(colors[i]);
            } else {
                // Generate a color using HSL
                const hue = (i * 137.508) % 360; // Golden angle approximation
                result.push(`hsl(${hue}, 70%, 50%)`);
            }
        }
        return result;
    }
    
    hexToRgb(hex) {
        // Handle HSL colors
        if (hex.startsWith('hsl')) {
            // Parse HSL: hsl(123, 70%, 50%)
            const match = hex.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
            if (match) {
                const h = parseInt(match[1]) / 360;
                const s = parseInt(match[2]) / 100;
                const l = parseInt(match[3]) / 100;
                
                let r, g, b;
                if (s === 0) {
                    r = g = b = l;
                } else {
                    const hue2rgb = (p, q, t) => {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1/6) return p + (q - p) * 6 * t;
                        if (t < 1/2) return q;
                        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                        return p;
                    };
                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    const p = 2 * l - q;
                    r = hue2rgb(p, q, h + 1/3);
                    g = hue2rgb(p, q, h);
                    b = hue2rgb(p, q, h - 1/3);
                }
                return {
                    r: Math.round(r * 255),
                    g: Math.round(g * 255),
                    b: Math.round(b * 255)
                };
            }
        }
        
        // Handle hex colors
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 112, b: 210 }; // Default to Salesforce blue
    }
}
