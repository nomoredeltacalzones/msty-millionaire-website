# MSTY Millionaire Website

A comprehensive platform for tracking YieldMax ETFs, calculating monthly income, and learning about high-yield investment strategies.

## Features

- **Real-time ETF Tracking**: Monitor MSTY, TSLY, NVDY, and 50+ income-generating ETFs
- **Income Calculator**: Calculate potential monthly income from YieldMax ETF investments
- **Educational Resources**: Learn about covered call strategies, risks, and tax implications
- **Portfolio Tools**: Track your holdings and optimize your investment strategy
- **Distribution Calendar**: Stay updated on payment schedules
- **Yield Rankings**: Compare performance across different ETFs

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Styling**: Custom CSS with responsive design
- **Deployment**: Netlify (Static Site)
- **Version Control**: Git/GitHub

## Project Structure

```
msty-millionaire-website/
├── css/
│   └── style.css          # Main stylesheet
├── js/
│   ├── main.js           # Core functionality
│   └── api-integration-guide.js  # API integration
├── images/               # Image assets
├── assets/              # Other assets
├── docs/                # Documentation
├── api/                 # API documentation
├── *.html              # All website pages
├── README.md           # This file
├── .gitignore          # Git ignore rules
├── netlify.toml        # Netlify configuration
├── robots.txt          # Search engine directives
└── sitemap.xml         # Site structure for SEO
```

## Pages Included

### Core Pages
- `index.html` - Main dashboard
- `calculator.html` - Investment calculator
- `education-v2.html` - Main educational hub
- `portfolio-v2.html` - User portfolio tracking page
- `faq-page.html` - Frequently asked questions
- `contact-page.html` - Contact form

### Tools & Calculators
- `compound-calculator.html` - Compound interest calculator
- `tax-calculator.html` - Tax implications calculator
- `risk-assessment-tool.html` - Risk assessment
- `portfolio-optimizer.html` - Portfolio optimization

### Educational Content
- `education-basics-page.html` - YieldMax basics
- `covered-calls-explained.html` - Options strategies
- `risk-management-strategy.html` - Risk management
- `tax-implications-guide.html` - Tax guidance

### Data & Tracking
- `live-tracker.html` - Real-time price tracking
- `distribution-tracker.html` - Distribution tracking
- `yield-rankings-page.html` - ETF performance rankings
- `distribution-calendar.html` - Payment calendar

### Community & Resources
- `blog-main-page-fixed.html` - Blog section
- `community-main.html` - Community hub
- `resources-main.html` - Resource center
- `weekly-newsletter.html` - Newsletter

### Account Management
- `account-login.html` - User login
- `account-register.html` - User registration
- `account-dashboard.html` - User dashboard
- `account-settings.html` - Account settings

### Legal & Compliance
- `privacy-policy-page.html` - Privacy policy
- `terms-of-service.html` - Terms of service
- `investment-disclaimer.html` - Investment disclaimer
- `affiliate-disclosure.html` - Affiliate disclosure

## Deployment Instructions

### GitHub Setup
1. Create a new repository on GitHub
2. Clone this repository or upload files
3. Commit and push all files

### Netlify Deployment
1. Connect your GitHub repository to Netlify
2. Set build command: (leave empty for static site)
3. Set publish directory: `/` (root)
4. Deploy automatically on git push

### Environment Variables (Future Implementation)
When implementing backend features, set these in Netlify:
- `IEX_CLOUD_KEY` - IEX Cloud API key
- `FINNHUB_KEY` - Finnhub API key
- `GOOGLE_ANALYTICS_ID` - Google Analytics tracking ID
- `GOOGLE_ADSENSE_ID` - Google AdSense publisher ID

## Development

### Local Development
1. Clone the repository
2. Open `index.html` in a web browser
3. For live reload, use a local server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

### Making Changes
1. Edit HTML, CSS, or JavaScript files
2. Test locally
3. Commit changes to git
4. Push to GitHub (auto-deploys to Netlify)

## Features to Implement

### Phase 1 (Current)
- [x] Static website structure
- [x] Responsive design
- [x] Basic calculator functionality
- [x] Navigation system

### Phase 2 (Future)
- [ ] Real-time API integration
- [ ] User authentication
- [ ] Database integration
- [ ] Email notifications

### Phase 3 (Advanced)
- [ ] Advanced portfolio analytics
- [ ] Social features
- [ ] Mobile app
- [ ] Premium subscriptions

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Optimized for fast loading
- Responsive design for all devices
- Progressive enhancement
- SEO optimized

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary. All rights reserved.

## Contact

For questions or support, visit the contact page or reach out through the website.

## Disclaimer

This website is for educational and informational purposes only. It does not constitute financial advice. Always consult with a qualified financial advisor before making investment decisions.

---

**MSTY Millionaire** - Your gateway to high-yield ETF investing

