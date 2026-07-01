import React from 'react';

export interface Capability {
  title: string;
  description: string;
  href: string;
}

export interface Industry {
  name: string;
  href: string;
}

export interface MegaMenuProps {
  isOpen?: boolean;
  capabilities?: Capability[];
  industries?: Industry[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const DEFAULT_CAPABILITIES: Capability[] = [
  {
    title: 'AI Engineering',
    description: 'Deploy and optimize custom machine learning models and large language models for enterprise workflows.',
    href: '#/capabilities/ai-engineering',
  },
  {
    title: 'Data Analytics',
    description: 'Transform raw data streams into actionable intelligence with interactive, real-time dashboards.',
    href: '#/capabilities/data-analytics',
  },
  {
    title: 'Cloud Architecture',
    description: 'Design resilient, scalable multi-cloud environments tailored for high-volume transactions.',
    href: '#/capabilities/cloud-architecture',
  },
  {
    title: 'Custom Software',
    description: 'Build bespoke web and mobile applications with focus on performance, security, and scalability.',
    href: '#/capabilities/custom-software',
  },
];

const DEFAULT_INDUSTRIES: Industry[] = [
  { name: 'Healthcare', href: '#/industries/healthcare' },
  { name: 'Financial Services', href: '#/industries/finance' },
  { name: 'Logistics & Supply Chain', href: '#/industries/logistics' },
  { name: 'Retail & E-Commerce', href: '#/industries/retail' },
  { name: 'Energy & Utilities', href: '#/industries/energy' },
];

export const MegaMenu: React.FC<MegaMenuProps> = ({
  isOpen = true,
  capabilities = DEFAULT_CAPABILITIES,
  industries = DEFAULT_INDUSTRIES,
  onMouseEnter,
  onMouseLeave,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute left-0 w-full bg-white border-t border-border shadow-xl z-50 transition-all duration-300 ease-in-out font-sans text-text-primary rounded-b-2xl"
      style={{ top: '100%' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="max-w-7xl mx-auto px-6 py-8 md:py-12 grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
        <div className="md:col-span-3 flex flex-col gap-6">
          <div className="font-mono text-caption text-slate-400 uppercase tracking-wider">
            / capabilities
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 md:gap-y-8">
            {capabilities.map((item) => (
              <a
                key={item.title}
                href={item.href}
                className="group flex flex-col gap-1.5 p-3 -m-3 hover:bg-slate-50 transition-all duration-200 rounded"
              >
                <div className="font-sans font-bold text-body text-text-primary group-hover:text-accent transition-colors flex items-center gap-1.5">
                  {item.title}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent text-body-sm">
                    →
                  </span>
                </div>
                <div className="text-body-sm text-text-muted leading-relaxed">
                  {item.description}
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="md:col-span-1 border-l border-border pl-0 md:pl-8 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-accent uppercase tracking-widest font-semibold">
              sectors
            </span>
            <h3 className="font-sans font-bold text-h4 text-text-primary">
              Industries
            </h3>
          </div>

          <ul className="flex flex-col gap-3">
            {industries.map((item) => (
              <li key={item.name}>
                <a
                  href={item.href}
                  className="text-body-sm text-text-muted hover:text-text-primary hover:pl-1 transition-all duration-200 block py-0.5 font-medium"
                >
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
