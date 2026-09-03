import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PageCapture {
  name: string;
  description: string;
  features: string[];
  uxHighlights: string[];
}

const APP_PAGES: PageCapture[] = [
  {
    name: 'Dashboard',
    description: 'Comprehensive business intelligence hub providing real-time visibility into key performance indicators, quote performance, and deal quality metrics.',
    features: [
      'Real-time KPI tracking with trend indicators',
      'Interactive deal score analytics with quality categorization',
      'Dynamic filters for product family, timeframe, region, and channel',
      'Price performance index tracking over time',
      'Margin causality analysis with waterfall visualization',
      'Quote status funnel with drill-down capabilities',
      'Win/loss rate tracking and analysis'
    ],
    uxHighlights: [
      'Clean, modern card-based layout with gradient accents',
      'Interactive stat cards with hover effects and drill-down functionality',
      'Color-coded status indicators for instant recognition',
      'Responsive charts with custom tooltips',
      'One-click drill-down to detailed quote lists',
      'Contextual date display for temporal awareness'
    ]
  },
  {
    name: 'Quote Builder',
    description: 'Intelligent quote configuration tool with advanced pricing logic, real-time calculations, and approval workflow integration.',
    features: [
      'Multi-line quote builder with product search',
      'Real-time price calculations with discount application',
      'Customer-specific pricing and price list integration',
      'Quantity break detection and application',
      'Deal score calculation with performance benchmarking',
      'Win probability assessment based on historical data',
      'Approval workflow routing based on authority limits',
      'PDF generation for professional quote documents'
    ],
    uxHighlights: [
      'Intuitive step-by-step quote creation flow',
      'Live calculation updates as items are added',
      'Smart product search with instant filtering',
      'Visual deal score indicators with color coding',
      'Clear pricing breakdown showing list price, discounts, and final price',
      'Inline editing capabilities for quick adjustments',
      'Professional PDF export with branding'
    ]
  },
  {
    name: 'Quotes List',
    description: 'Centralized quote management system with comprehensive filtering, searching, and bulk operations.',
    features: [
      'Complete quote history with status tracking',
      'Advanced filtering by status, customer, date range',
      'Quick search across quote numbers and customer names',
      'Bulk operations for efficient management',
      'Clone functionality for similar quotes',
      'Direct PDF download from list view',
      'Status-based color coding for quick identification'
    ],
    uxHighlights: [
      'Sortable table with responsive design',
      'Status badges with semantic colors',
      'Hover actions for quick access to common operations',
      'Clean, scannable list layout',
      'Pagination for large datasets',
      'Inline preview of key quote details'
    ]
  },
  {
    name: 'Approvals',
    description: 'Streamlined approval workflow system with role-based permissions and comprehensive audit trails.',
    features: [
      'Queue-based approval management',
      'Role-based approval authority levels',
      'Margin and quote size thresholds',
      'Detailed quote preview in approval context',
      'Comment system for approval feedback',
      'Approval history and audit trail',
      'Escalation tracking for out-of-authority requests'
    ],
    uxHighlights: [
      'Clear pending/approved/rejected status visualization',
      'Contextual quote details within approval view',
      'One-click approve/reject with optional comments',
      'Visual hierarchy emphasizing critical decisions',
      'Timestamp tracking for accountability',
      'Responsive approval cards with all key information'
    ]
  },
  {
    name: 'Product Catalog',
    description: 'Comprehensive product management system with hierarchical organization and pricing control.',
    features: [
      'Multi-level product hierarchy (Family, Category, Line)',
      'SKU and description management',
      'Base cost and list price tracking',
      'Product status management (Active/Inactive)',
      'Bulk import capabilities',
      'Product search and filtering',
      'Cost history tracking for margin analysis'
    ],
    uxHighlights: [
      'Clean tabular layout with inline editing',
      'Quick-add forms for new products',
      'Color-coded status indicators',
      'Hierarchical organization for easy navigation',
      'Responsive design for mobile and desktop',
      'Search functionality for large catalogs'
    ]
  },
  {
    name: 'Price Lists',
    description: 'Advanced pricing management with customer-specific and segment-based pricing strategies.',
    features: [
      'Multiple price list creation and management',
      'Customer assignment to price lists',
      'Product-specific pricing overrides',
      'Validity date range management',
      'Currency support for global pricing',
      'Price list cloning for efficiency',
      'Bulk price updates and adjustments'
    ],
    uxHighlights: [
      'Organized list view with expandable details',
      'Clear customer assignment indicators',
      'Date range visualization for pricing validity',
      'Modal-based editing for focused data entry',
      'Visual grouping of related price information',
      'Intuitive price override interface'
    ]
  },
  {
    name: 'Quantity Breaks',
    description: 'Volume-based pricing engine with tiered discount structures and performance analytics.',
    features: [
      'Tiered quantity break configuration',
      'Product-specific break point definition',
      'Percentage and fixed amount discounts',
      'Date-based validity management',
      'Analytics on quantity break utilization',
      'Performance tracking of volume incentives',
      'Customer adoption metrics'
    ],
    uxHighlights: [
      'Clear tier visualization with threshold indicators',
      'Progressive discount display',
      'Analytics dashboard for break performance',
      'Color-coded utilization metrics',
      'Easy tier management interface',
      'Visual indicators of active vs inactive breaks'
    ]
  },
  {
    name: 'Customers',
    description: 'Complete customer relationship management with detailed profiles and interaction history.',
    features: [
      'Comprehensive customer profiles',
      'Industry and segment classification',
      'Annual revenue tracking',
      'Quote history per customer',
      'Contact information management',
      'Customer status tracking',
      'Regional assignment for localized pricing'
    ],
    uxHighlights: [
      'Card-based customer profiles',
      'Quick-view customer statistics',
      'Inline editing for rapid updates',
      'Color-coded status and segment indicators',
      'Organized contact information layout',
      'Associated quote history access'
    ]
  },
  {
    name: 'Analytics',
    description: 'Comprehensive business intelligence suite with deep-dive analytical capabilities across multiple dimensions.',
    features: [
      'Business performance dashboard with revenue metrics',
      'Price waterfall analysis showing discount cascades',
      'Quote funnel visualization with conversion rates',
      'Customer-level price performance tracking',
      'Mix analysis for product portfolio optimization',
      'List price adherence monitoring',
      'Time-series trend analysis',
      'Margin analysis across dimensions'
    ],
    uxHighlights: [
      'Multi-chart dashboard with coordinated views',
      'Interactive visualizations with drill-down',
      'Tab-based organization for easy navigation',
      'Professional chart styling with clear legends',
      'Responsive layout adapting to screen size',
      'Export capabilities for reporting'
    ]
  },
  {
    name: 'AI Analytics',
    description: 'Natural language query interface for conversational data exploration and insights.',
    features: [
      'Natural language question processing',
      'Dynamic SQL query generation',
      'Interactive results visualization',
      'Question library with predefined queries',
      'Custom question capability',
      'Historical query tracking',
      'Context-aware suggestions'
    ],
    uxHighlights: [
      'Chat-like interface for natural interaction',
      'Visual query results with formatted tables',
      'One-click question library access',
      'Clean, focused query input',
      'Real-time query execution feedback',
      'Organized results presentation'
    ]
  },
  {
    name: 'Rules-Based Pricing Engine',
    description: 'Sophisticated pricing automation with configurable business rules and conditions.',
    features: [
      'Multi-condition rule builder',
      'Customer segment targeting',
      'Product family-based rules',
      'Deal size thresholds',
      'Percentage and fixed adjustments',
      'Rule priority and sequencing',
      'Active/inactive rule management',
      'Rule performance tracking'
    ],
    uxHighlights: [
      'Visual rule builder with clear conditions',
      'Card-based rule organization',
      'Status toggles for quick activation/deactivation',
      'Clear condition and action display',
      'Modal-based rule creation wizard',
      'Color-coded rule status'
    ]
  },
  {
    name: 'Price Simulation',
    description: 'What-if analysis tool for testing pricing strategies before implementation.',
    features: [
      'Scenario-based price modeling',
      'Product selection for simulation',
      'Multi-variable price adjustment',
      'Revenue impact projection',
      'Margin impact calculation',
      'Volume assumption modeling',
      'Comparison of multiple scenarios'
    ],
    uxHighlights: [
      'Side-by-side scenario comparison',
      'Visual impact indicators',
      'Interactive adjustment controls',
      'Real-time calculation updates',
      'Clear before/after visualization',
      'Professional results presentation'
    ]
  },
  {
    name: 'Price Alerts',
    description: 'Proactive monitoring system for pricing exceptions and margin concerns.',
    features: [
      'Automated cost change detection',
      'Margin threshold alerts',
      'Price variance notifications',
      'Alert prioritization (High, Medium, Low)',
      'Alert resolution tracking',
      'Historical alert log',
      'Customizable alert thresholds'
    ],
    uxHighlights: [
      'Color-coded alert severity',
      'Clear alert cards with key information',
      'One-click alert acknowledgment',
      'Visual priority indicators',
      'Organized alert queue',
      'Status-based filtering'
    ]
  },
  {
    name: 'Commissions',
    description: 'Sales compensation management with configurable rules and performance tracking.',
    features: [
      'Flexible commission structure definition',
      'Tiered commission rates',
      'Product-based commission rules',
      'Sales rep assignment to quotes',
      'Commission calculation engine',
      'Payment tracking and history',
      'Performance leaderboards'
    ],
    uxHighlights: [
      'Clear commission structure display',
      'Visual tier representation',
      'Rep-level performance views',
      'Transaction history with details',
      'Summary cards with key metrics',
      'Professional statement generation'
    ]
  },
  {
    name: 'Pricing Excellence',
    description: 'Strategic pricing maturity assessment and improvement roadmap tool.',
    features: [
      'Multi-dimension maturity scoring',
      'Category-based assessment (Strategy, Analytics, Processes, etc.)',
      'Strength and improvement identification',
      'Progress tracking over time',
      'Benchmark comparisons',
      'Actionable recommendations',
      'Maturity level visualization'
    ],
    uxHighlights: [
      'Interactive assessment questionnaire',
      'Visual maturity radar chart',
      'Color-coded strength/weakness indicators',
      'Progress tracking dashboard',
      'Clear scoring methodology',
      'Actionable insights presentation'
    ]
  },
  {
    name: 'Deal Score Analytics',
    description: 'Advanced deal quality assessment with historical benchmarking and predictive insights.',
    features: [
      'Multi-factor deal scoring algorithm',
      'Historical performance benchmarking',
      'Win probability calculation',
      'Deal quality categorization',
      'Score accuracy tracking',
      'Performance trend analysis',
      'Factor contribution breakdown'
    ],
    uxHighlights: [
      'Visual score indicators with color coding',
      'Clear quality category labels (Excellent, Good, Needs Attention)',
      'Factor breakdown visualization',
      'Historical comparison charts',
      'Trend indicators for insights',
      'Easy-to-understand scoring display'
    ]
  },
  {
    name: 'Services',
    description: 'Professional services catalog with SLA management and service bundling.',
    features: [
      'Service catalog management',
      'SLA definition and tracking',
      'Service pricing configuration',
      'Bundle creation for packages',
      'Service attachment to quotes',
      'Delivery tracking',
      'Service performance metrics'
    ],
    uxHighlights: [
      'Organized service catalog',
      'Clear SLA visualizations',
      'Service card-based layout',
      'Bundle composition display',
      'Status and availability indicators',
      'Professional service descriptions'
    ]
  },
  {
    name: 'Users & Permissions',
    description: 'Role-based access control with comprehensive user management.',
    features: [
      'User profile management',
      'Role assignment (Admin, Sales Manager, Sales Rep, etc.)',
      'Permission-based feature access',
      'Approval authority configuration',
      'User activity tracking',
      'Team organization',
      'Status management (Active/Inactive)'
    ],
    uxHighlights: [
      'Clean user list with key information',
      'Role badges for quick identification',
      'Inline editing capabilities',
      'Modal-based user creation',
      'Permission level indicators',
      'Organized user profiles'
    ]
  },
  {
    name: 'Settings',
    description: 'Centralized configuration hub for system-wide preferences and customization.',
    features: [
      'Company profile configuration',
      'Currency and regional settings',
      'Default discount thresholds',
      'Approval workflow configuration',
      'System preferences',
      'Integration settings',
      'Notification preferences'
    ],
    uxHighlights: [
      'Tabbed organization for easy navigation',
      'Form-based settings input',
      'Clear setting descriptions',
      'Save confirmation feedback',
      'Organized by functional area',
      'Professional settings layout'
    ]
  }
];

interface CapturedScreenshot {
  pageName: string;
  imageData: string;
  timestamp: Date;
}

export function MarketingReport() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [screenshots, setScreenshots] = useState<Map<string, CapturedScreenshot>>(new Map());
  const [capturing, setCapturing] = useState(false);

  const captureCurrentPage = async (pageName: string) => {
    setCapturing(true);
    setProgress(`Capturing ${pageName}...`);

    try {
      const mainContent = document.querySelector('.space-y-6');
      if (!mainContent) {
        setProgress('Could not find page content to capture');
        setTimeout(() => {
          setProgress('');
          setCapturing(false);
        }, 2000);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(mainContent as HTMLElement, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1280,
        windowHeight: Math.min(mainContent.scrollHeight, 2000),
        onclone: (clonedDoc) => {
          const clonedContent = clonedDoc.querySelector('.space-y-6');
          if (clonedContent) {
            const canvasElements = clonedContent.querySelectorAll('canvas');
            canvasElements.forEach((canvas) => {
              const img = clonedDoc.createElement('img');
              img.src = (canvas as HTMLCanvasElement).toDataURL();
              canvas.parentNode?.replaceChild(img, canvas);
            });
          }
        }
      });

      const imageData = canvas.toDataURL('image/png', 0.8);

      setScreenshots(prev => new Map(prev).set(pageName, {
        pageName,
        imageData,
        timestamp: new Date()
      }));

      setProgress(`Screenshot captured for ${pageName}!`);
      setTimeout(() => {
        setProgress('');
        setCapturing(false);
      }, 2000);
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setProgress(`Error: ${errorMessage}. Try a different page or refresh.`);
      setTimeout(() => {
        setProgress('');
        setCapturing(false);
      }, 3000);
    }
  };

  const clearScreenshots = () => {
    setScreenshots(new Map());
    setProgress('All screenshots cleared');
    setTimeout(() => setProgress(''), 2000);
  };

  const generateReport = async () => {
    setGenerating(true);
    setProgress('Initializing report generation...');

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      // Cover Page
      setProgress('Creating cover page...');
      pdf.setFillColor(16, 185, 129);
      pdf.rect(0, 0, pageWidth, 80, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(32);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Price Space CPQ', pageWidth / 2, 40, { align: 'center' });

      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Complete Platform Overview', pageWidth / 2, 55, { align: 'center' });
      pdf.text('Features & User Experience', pageWidth / 2, 65, { align: 'center' });

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`, pageWidth / 2, 100, { align: 'center' });

      // Executive Summary
      pdf.addPage();
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(16, 185, 129);
      pdf.text('Executive Summary', margin, 30);

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);

      const summary = [
        'Price Space CPQ is a comprehensive Configure-Price-Quote platform designed for modern',
        'enterprises seeking to optimize their pricing strategies and streamline quote-to-cash processes.',
        '',
        'KEY CAPABILITIES:',
        '',
        '• Intelligent Quote Building - AI-powered pricing recommendations and deal scoring',
        '• Advanced Analytics - Multi-dimensional business intelligence and reporting',
        '• Pricing Automation - Rules-based pricing engine with sophisticated logic',
        '• Approval Workflows - Role-based approval routing with authority limits',
        '• Customer Management - Complete CRM integration with pricing history',
        '• Product Catalog - Hierarchical organization with cost and price tracking',
        '• Commission Management - Flexible compensation structures and tracking',
        '• Price Optimization - Simulation tools and maturity assessment',
        '',
        'TECHNICAL HIGHLIGHTS:',
        '',
        '• Modern, responsive web application built with React and TypeScript',
        '• Real-time data synchronization with Supabase backend',
        '• Advanced data visualization with interactive charts',
        '• Natural language AI analytics powered by Claude',
        '• Professional PDF generation for quotes and reports',
        '• Mobile-optimized interface for on-the-go access',
        '',
        'USER EXPERIENCE:',
        '',
        '• Clean, intuitive interface with minimal learning curve',
        '• Consistent design language across all modules',
        '• Contextual help and guidance throughout workflows',
        '• Fast, responsive interactions with instant feedback',
        '• Professional styling suitable for executive presentations'
      ];

      let yPos = 45;
      summary.forEach(line => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        pdf.text(line, margin, yPos);
        yPos += 6;
      });

      // Table of Contents
      pdf.addPage();
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(16, 185, 129);
      pdf.text('Table of Contents', margin, 30);

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);

      yPos = 45;
      APP_PAGES.forEach((page, index) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        pdf.text(`${index + 1}. ${page.name}`, margin, yPos);
        yPos += 8;
      });

      // Feature Pages
      for (let i = 0; i < APP_PAGES.length; i++) {
        const page = APP_PAGES[i];
        setProgress(`Generating content for ${page.name}... (${i + 1}/${APP_PAGES.length})`);

        pdf.addPage();

        // Page Header
        pdf.setFillColor(16, 185, 129);
        pdf.rect(0, 0, pageWidth, 35, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${i + 1}. ${page.name}`, margin, 20);

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Page ${pdf.internal.pages.length - 1}`, pageWidth - margin, 20, { align: 'right' });

        // Description
        yPos = 50;
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'italic');

        const descLines = pdf.splitTextToSize(page.description, contentWidth);
        descLines.forEach((line: string) => {
          if (yPos > pageHeight - margin) {
            pdf.addPage();
            yPos = margin;
          }
          pdf.text(line, margin, yPos);
          yPos += 6;
        });

        yPos += 8;

        // Screenshot Section
        const screenshot = screenshots.get(page.name);
        if (screenshot) {
          // Add actual screenshot
          const imgWidth = contentWidth;
          const imgHeight = 100;

          try {
            pdf.addImage(screenshot.imageData, 'PNG', margin, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 5;
          } catch (error) {
            console.error('Error adding image:', error);
            // Fall back to placeholder
            pdf.setDrawColor(16, 185, 129);
            pdf.setFillColor(240, 253, 244);
            pdf.setLineWidth(0.5);
            pdf.rect(margin, yPos, contentWidth, 80, 'FD');
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.text('Screenshot could not be added', pageWidth / 2, yPos + 40, { align: 'center' });
            yPos += 88;
          }
        } else {
          // Screenshot Placeholder Box
          pdf.setDrawColor(16, 185, 129);
          pdf.setFillColor(240, 253, 244);
          pdf.setLineWidth(0.5);
          pdf.rect(margin, yPos, contentWidth, 80, 'FD');

          pdf.setFontSize(10);
          pdf.setTextColor(16, 185, 129);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Visual Preview', pageWidth / 2, yPos + 35, { align: 'center' });

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(100, 100, 100);
          pdf.text(`${page.name} Interface Screenshot`, pageWidth / 2, yPos + 42, { align: 'center' });
          pdf.text('Navigate to this section and click "Capture Screenshot"', pageWidth / 2, yPos + 50, { align: 'center' });
          pdf.text('before generating the report to include actual visuals', pageWidth / 2, yPos + 57, { align: 'center' });

          yPos += 88;
        }

        // Key Features
        if (yPos > pageHeight - 80) {
          pdf.addPage();
          yPos = margin;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(16, 185, 129);
        pdf.text('Key Features:', margin, yPos);
        yPos += 8;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);

        page.features.forEach(feature => {
          const featureLines = pdf.splitTextToSize(`• ${feature}`, contentWidth - 5);
          featureLines.forEach((line: string) => {
            if (yPos > pageHeight - margin) {
              pdf.addPage();
              yPos = margin;
            }
            pdf.text(line, margin + 5, yPos);
            yPos += 5;
          });
        });

        yPos += 5;

        // UX Highlights
        if (yPos > pageHeight - 60) {
          pdf.addPage();
          yPos = margin;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(16, 185, 129);
        pdf.text('User Experience Highlights:', margin, yPos);
        yPos += 8;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);

        page.uxHighlights.forEach(highlight => {
          const highlightLines = pdf.splitTextToSize(`• ${highlight}`, contentWidth - 5);
          highlightLines.forEach((line: string) => {
            if (yPos > pageHeight - margin) {
              pdf.addPage();
              yPos = margin;
            }
            pdf.text(line, margin + 5, yPos);
            yPos += 5;
          });
        });
      }

      // Closing Page
      pdf.addPage();
      pdf.setFillColor(16, 185, 129);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Thank You', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('For more information about Price Space CPQ', pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
      pdf.text('please contact your sales representative', pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });

      setProgress('Finalizing PDF...');
      pdf.save(`PriceSpace-CPQ-Overview-${new Date().toISOString().split('T')[0]}.pdf`);

      setProgress('Report generated successfully!');
      setTimeout(() => {
        setGenerating(false);
        setProgress('');
      }, 2000);

    } catch (error) {
      console.error('Error generating report:', error);
      setProgress('Error generating report. Please try again.');
      setTimeout(() => {
        setGenerating(false);
        setProgress('');
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Marketing Report</h2>
        <p className="text-slate-600 mt-1">
          Generate a comprehensive PDF overview of all platform features with screenshots
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
            <FileText className="text-white" size={32} />
          </div>

          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 mb-3">
              Complete Platform Overview Report
            </h3>

            <div className="space-y-3 text-slate-600 mb-6">
              <p>
                This comprehensive report is designed for your marketing team and includes detailed
                information about every feature and module in Price Space CPQ.
              </p>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-900 mb-2">Report Contents:</h4>
                <ul className="space-y-1 text-sm text-emerald-800">
                  <li>• Executive summary with key capabilities</li>
                  <li>• Detailed feature descriptions for all {APP_PAGES.length} modules</li>
                  <li>• Screenshots and visualizations from each section</li>
                  <li>• User experience highlights and design philosophy</li>
                  <li>• Technical capabilities overview</li>
                  <li>• Professional formatting ready for stakeholder distribution</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">How to Include Screenshots:</h4>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>1. Navigate to each section you want to capture (Dashboard, Analytics, etc.)</li>
                  <li>2. Use the "Capture Screenshot" dropdown below to capture the current page</li>
                  <li>3. Once you've captured all desired sections, generate the report</li>
                  <li>4. Screenshots will be automatically included in the PDF</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={generateReport}
                disabled={generating}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Generating Report...</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>Generate Report ({screenshots.size} screenshot{screenshots.size !== 1 ? 's' : ''})</span>
                  </>
                )}
              </button>

              {screenshots.size > 0 && (
                <button
                  onClick={clearScreenshots}
                  disabled={generating || capturing}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear Screenshots
                </button>
              )}
            </div>

            {progress && (
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-700 flex items-center gap-2">
                  {(generating || capturing) && <Loader2 className="animate-spin" size={16} />}
                  {progress}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Capture Screenshots</h3>
        <p className="text-sm text-slate-600 mb-4">
          Navigate to any section of the application, then select it from the dropdown below to capture a screenshot for the marketing report.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {APP_PAGES.map((page, index) => {
            const isCaptured = screenshots.has(page.name);
            return (
              <button
                key={index}
                onClick={() => captureCurrentPage(page.name)}
                disabled={capturing || generating}
                className={`p-4 rounded-lg border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCaptured
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-emerald-500 text-white rounded text-xs flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <h4 className="font-semibold text-slate-900 text-sm">{page.name}</h4>
                  </div>
                  {isCaptured && (
                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  {isCaptured ? 'Screenshot captured!' : 'Click to capture current view'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Modules Included in Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {APP_PAGES.map((page, index) => (
            <div
              key={index}
              className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-emerald-500 text-white rounded text-xs flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <h4 className="font-semibold text-slate-900 text-sm">{page.name}</h4>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2">{page.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-medium">
                  {page.features.length} features
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-blue-600 font-medium">
                  {page.uxHighlights.length} UX highlights
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
