import React from 'react';
import { Linkedin, Instagram } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#0B1E2B] text-white py-12 md:py-16 px-6 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-12">
          <div className="flex flex-col gap-6">
            <span className="font-sans font-bold text-h2 tracking-tight text-white select-none">
              Meridian
            </span>
            <div className="flex gap-4">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-white/20 hover:border-white hover:text-accent flex items-center justify-center text-white/70 transition-all duration-200"
                aria-label="LinkedIn"
              >
                <Linkedin size={18} strokeWidth={1.5} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-white/20 hover:border-white hover:text-accent flex items-center justify-center text-white/70 transition-all duration-200"
                aria-label="Instagram"
              >
                <Instagram size={18} strokeWidth={1.5} />
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-mono text-caption uppercase tracking-wider text-white/50">
              Company
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a href="#/about" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#/careers" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#/news" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  News
                </a>
              </li>
              <li>
                <a href="#/contact" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-mono text-caption uppercase tracking-wider text-white/50">
              Capabilities
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a href="#/capabilities/ai-engineering" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  AI Engineering
                </a>
              </li>
              <li>
                <a href="#/capabilities/data-analytics" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  Data Analytics
                </a>
              </li>
              <li>
                <a href="#/capabilities/cloud-architecture" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  Cloud Architecture
                </a>
              </li>
              <li>
                <a href="#/capabilities/custom-software" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  Custom Software
                </a>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-mono text-caption uppercase tracking-wider text-white/50">
              Industries
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a href="#/industries/healthcare" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  Healthcare
                </a>
              </li>
              <li>
                <a href="#/industries/finance" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  Financial Services
                </a>
              </li>
              <li>
                <a href="#/industries/logistics" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  Logistics
                </a>
              </li>
              <li>
                <a href="#/industries/retail" className="text-body-sm text-white/75 hover:text-accent transition-colors">
                  Retail
                </a>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-mono text-caption uppercase tracking-wider text-white/50">
              Find Us
            </h4>
            <ul className="flex flex-col gap-3.5 text-body-sm text-white/75">
              <li>
                <p className="font-bold text-white">United Kingdom</p>
                <p className="text-white/60 text-caption mt-0.5">London Office</p>
              </li>
              <li>
                <p className="font-bold text-white">United States</p>
                <p className="text-white/60 text-caption mt-0.5">New York Office</p>
              </li>
              <li>
                <p className="font-bold text-white">Germany</p>
                <p className="text-white/60 text-caption mt-0.5">Munich Hub</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-caption text-white/50 order-2 md:order-1">
            &copy; {currentYear} Meridian. All rights reserved.
          </p>
          <div className="flex gap-6 order-1 md:order-2">
            <a href="#/terms" className="text-caption text-white/50 hover:text-white transition-colors">
              Terms
            </a>
            <a href="#/privacy" className="text-caption text-white/50 hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#/cookie-policy" className="text-caption text-white/50 hover:text-white transition-colors">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
