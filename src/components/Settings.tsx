import { useState } from 'react';
import { FileDown, FileText, BookOpen, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';

export function Settings() {
  const [downloading, setDownloading] = useState(false);

  const generateQuickDemoPDF = () => {
    setDownloading(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      const addPage = () => {
        pdf.addPage();
        yPosition = margin;
      };

      const checkPageBreak = (requiredSpace: number) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          addPage();
          return true;
        }
        return false;
      };

      const addText = (text: string, fontSize: number, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        pdf.setTextColor(color[0], color[1], color[2]);
        const lines = pdf.splitTextToSize(text, contentWidth);

        for (let i = 0; i < lines.length; i++) {
          checkPageBreak(fontSize * 0.5);
          pdf.text(lines[i], margin, yPosition);
          yPosition += fontSize * 0.5;
        }
      };

      const addHeading = (text: string, level: number = 1) => {
        yPosition += level === 1 ? 10 : 5;
        checkPageBreak(15);
        const fontSize = level === 1 ? 18 : level === 2 ? 14 : 12;
        addText(text, fontSize, true, [16, 185, 129]);
        yPosition += 3;
      };

      const addBullet = (text: string) => {
        checkPageBreak(8);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        pdf.text('•', margin + 5, yPosition);
        const lines = pdf.splitTextToSize(text, contentWidth - 10);
        for (let i = 0; i < lines.length; i++) {
          pdf.text(lines[i], margin + 10, yPosition);
          yPosition += 5;
        }
      };

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(16, 185, 129);
      pdf.text('PriceSpace CPQ', margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(16);
      pdf.setTextColor(100, 100, 100);
      pdf.text('5-Minute Demo Script', margin, yPosition);
      yPosition += 15;

      addHeading('The 5-Minute Power Demo', 1);
      addText('Perfect for elevator pitches and quick overviews. Show the power of intelligent CPQ in just 5 minutes.', 10);
      yPosition += 8;

      addHeading('Slide 1: Dashboard (30 seconds)', 2);
      addText('Navigation: Click Dashboard', 10, true);
      yPosition += 3;
      addText('What to Say:', 10, true);
      addText('"This is PriceSpace - a complete CPQ platform managing 3,800+ quotes across 1,000+ products and 400 customers. Notice the real-time deal score analytics showing our quote quality is consistently above 85."', 10);
      yPosition += 3;
      addText('Point Out:', 10, true);
      addBullet('Quote activity trends');
      addBullet('Deal score health metrics');
      addBullet('Commission tracking overview');

      yPosition += 5;
      addHeading('Slide 2: Create Quote (90 seconds)', 2);
      addText('Navigation: Click Create Quote', 10, true);
      yPosition += 3;
      addText('What to Say:', 10, true);
      addText('"Let me show you how fast we can create a quote. Watch the automation."', 10);
      yPosition += 5;

      addText('Demo Steps:', 10, true);
      addBullet('Select "Tech Innovations Inc" (Enterprise customer)');
      addBullet('Select "Enterprise Customers" price list');
      addBullet('Search "Actuator" → Add 50 units (quantity break applies)');
      addBullet('Search "Bearing" → Add 100 units (15% volume discount)');
      addBullet('Click Services → Add "Premium Support"');
      yPosition += 3;

      addText('Key Talking Points:', 10, true);
      addBullet('Notice the quantity break discount automatically applied');
      addBullet('Deal score calculates in real-time (aim for 80+)');
      addBullet('This predicts high win probability');
      addBullet('System guides better pricing decisions instantly');
      yPosition += 3;

      addText('"What took 45 minutes in spreadsheets now takes 2 minutes."', 10, true);

      yPosition += 8;
      addHeading('Slide 3: Deal Score Intelligence (60 seconds)', 2);
      addText('Navigation: Click Deal Score Analytics', 10, true);
      yPosition += 3;
      addText('What to Say:', 10, true);
      addText('"Here\'s the secret sauce - our deal scoring engine analyzes every quote across 5 dimensions:"', 10);
      yPosition += 3;

      addBullet('Margin health (30% weight)');
      addBullet('Competitive positioning (25% weight)');
      addBullet('Deal velocity (20% weight)');
      addBullet('Customer fit (15% weight)');
      addBullet('Discount discipline (10% weight)');
      yPosition += 5;

      addText('"Quotes scoring above 70 win 40% more often and have 25% better margins. This is predictive intelligence built into every deal."', 10);

      yPosition += 8;
      addHeading('Slide 4: Commission Automation (60 seconds)', 2);
      addText('Navigation: Click Commissions', 10, true);
      yPosition += 3;
      addText('What to Say:', 10, true);
      addText('"Commissions are automatically calculated when quotes are created. But here\'s what makes it powerful - we tie commission rates to BOTH deal size AND deal quality."', 10);
      yPosition += 5;

      addText('Example:', 10, true);
      addBullet('$200k deal with score 85: 6% base + 2% bonus = 8% = $16k');
      addBullet('$200k deal with score 65: 6% base + 0% bonus = 6% = $12k');
      yPosition += 3;

      addText('"This creates alignment. Reps are incentivized to maintain good margins and avoid heavy discounting."', 10);

      yPosition += 8;
      addHeading('Slide 5: Price Intelligence (60 seconds)', 2);
      addText('Navigation: Click Price Alerts', 10, true);
      yPosition += 3;
      addText('What to Say:', 10, true);
      addText('"Cost management is proactive, not reactive. We\'re tracking 8 expected cost increases from suppliers. Each alert shows the impact and recommends price adjustments."', 10);
      yPosition += 5;

      addText('Demonstrate:', 10, true);
      addBullet('Select 2-3 alerts');
      addBullet('Click "Update Selected"');
      addBullet('Choose strategy: maintain margin %, dollar profit, or recommended');
      addBullet('Update hundreds of prices with one click');
      yPosition += 3;

      addText('"This protects profitability automatically. No more surprises, no more margin squeeze."', 10);

      addPage();
      yPosition = margin;

      addHeading('Closing (30 seconds)', 2);
      addText('What to Say:', 10, true);
      addText('"So what did we just see?"', 10);
      yPosition += 5;

      addBullet('Faster: Quotes in 2 minutes instead of 45');
      addBullet('Smarter: AI-powered deal scoring prevents bad deals');
      addBullet('Automated: Commissions, approvals, discounts - all automatic');
      addBullet('Protected: Proactive cost management and margin controls');
      yPosition += 5;

      addText('"This is how modern B2B companies win - with intelligent pricing and automated workflows. Questions?"', 10);

      yPosition += 10;
      addHeading('Value Props by Persona', 1);
      yPosition += 3;

      addText('For Sales Reps:', 10, true);
      addText('"Create quotes 10x faster with real-time guidance that helps you win more deals."', 10);
      yPosition += 5;

      addText('For Sales Managers:', 10, true);
      addText('"Predict which deals will win with 85% accuracy and protect margins automatically."', 10);
      yPosition += 5;

      addText('For Finance/Pricing:', 10, true);
      addText('"Automate price management across 1000+ products and respond to market changes in minutes."', 10);
      yPosition += 5;

      addText('For CFO:', 10, true);
      addText('"Improve margins by 3-5% and eliminate commission errors while scaling your sales team."', 10);

      yPosition += 10;
      addHeading('Common Questions & Answers', 1);
      yPosition += 3;

      addText('Q: How long to implement?', 10, true);
      addText('A: 4-6 weeks including integrations and training. POC in 2 weeks.', 10);
      yPosition += 5;

      addText('Q: What about integrations?', 10, true);
      addText('A: REST API for Salesforce, NetSuite, SAP, HubSpot, QuickBooks. Webhooks for real-time sync.', 10);
      yPosition += 5;

      addText('Q: How much does it cost?', 10, true);
      addText('A: $500/mo (10 users) to $3,000/mo (50 users). Enterprise custom pricing. 3-4 month ROI typical.', 10);
      yPosition += 5;

      addText('Q: What makes you different?', 10, true);
      addText('A: Deal intelligence layer. We predict wins and optimize commissions, not just process quotes.', 10);

      yPosition += 10;
      addHeading('Demo Data Available', 1);
      yPosition += 3;

      const demoData = [
        'Products: 1,045 active across 10 categories',
        'Customers: 400 across Enterprise/Mid-Market/Small Business',
        'Price Lists: 7 (Master + Regional + Segment-based)',
        'Historical Quotes: 3,816 with deal scores',
        'Quantity Breaks: 1,001 discount rules',
        'Services: 5 tiers (Basic to White Glove)',
        'Cost Alerts: 8 active alerts',
        'Commissions: 30 records ($257k tracked)',
        'Commission Tiers: 4 tiers (3-8% rates)'
      ];

      demoData.forEach(item => addBullet(item));

      yPosition += 10;
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by PriceSpace CPQ - Demo Ready System', margin, pageHeight - 10);

      pdf.save('PriceSpace-5-Minute-Demo-Script.pdf');

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <FileText className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Settings & Resources</h1>
            <p className="text-slate-600 mt-1">Download demo scripts and access helpful resources</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-50/50 rounded-xl p-6 border border-emerald-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <BookOpen className="text-emerald-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">5-Minute Demo Script</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Quick demo guide perfect for elevator pitches, executive overviews, and first meetings.
                  Covers all key features in just 5 minutes.
                </p>
                <button
                  onClick={generateQuickDemoPDF}
                  disabled={downloading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-600 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileDown size={18} />
                  {downloading ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-50/50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <CheckCircle className="text-blue-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Demo Data Status</h3>
                <p className="text-sm text-slate-600 mb-4">
                  All demo data is pre-loaded and ready to use. System includes 1,045 products,
                  400 customers, 3,816 quotes, and more.
                </p>
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Products: 1,045 active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Customers: 400 across segments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Historical Quotes: 3,816</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Commissions: 30 records</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-slate-50 rounded-xl p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Demo Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-slate-800">Do:</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Show real numbers and calculations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Demonstrate workflows, not just features</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Ask questions and engage the audience</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Highlight automation and time savings</span>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-slate-800">Don't:</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Rush through features</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Use technical jargon unnecessarily</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Show incomplete or broken features</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>Forget to close with clear next steps</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl p-6 border border-emerald-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Demo Success Metrics</h3>
          <p className="text-sm text-slate-600 mb-4">
            After your demo, the prospect should understand:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700">
            <div className="flex items-start gap-2">
              <CheckCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>How the system accelerates quote generation</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>How deal scores improve win rates and margins</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>How commission automation reduces errors</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>How cost alerts protect profitability</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
