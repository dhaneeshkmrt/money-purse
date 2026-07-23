'use client';

import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { LayoutDashboard, ReceiptText, Shapes, Shield, Building2, Settings, Landmark, Loader2, DatabaseBackup, Database, Wallet, Wand2, Calculator, BellRing, ScrollText, HandCoins, ShieldCheck, NotebookPen } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/provider';
import { cn } from '@/lib/utils';

type NavItemWithHref = {
  href: string;
  label: string;
  icon: React.ComponentType;
  featureFlag?: 'balanceSheet' | 'virtualAccounts' | 'yearlyReport' | 'aiImageStudio' | 'calculators' | 'admin' | 'reminders' | 'logs' | 'borrowings' | 'insurance' | 'notes'
};

type NavItemWithSubItems = {
  label: string;
  icon: React.ComponentType;
  subItems: NavItemWithHref[];
  featureFlag?: 'calculators' | 'admin' | 'borrowings';
};

type NavItem = NavItemWithHref | NavItemWithSubItems;

function hasHref(item: NavItem): item is NavItemWithHref {
  return 'href' in item;
}

function hasSubItems(item: NavItem): item is NavItemWithSubItems {
  return 'subItems' in item;
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ReceiptText },
  { href: '/categories', label: 'Categories', icon: Shapes },
  { href: '/reminders', label: 'Reminders', icon: BellRing, featureFlag: 'reminders' },
  { href: '/notes', label: 'Notes', icon: NotebookPen, featureFlag: 'notes' },
  {
      label: 'Borrowings',
      icon: HandCoins,
      featureFlag: 'borrowings',
      subItems: [
          { href: '/borrowings', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/borrowings/contacts', label: 'Contacts', icon: Building2 },
      ]
  },
  { href: '/insurance', label: 'Insurance', icon: ShieldCheck, featureFlag: 'insurance' },
  { href: '/accounts', label: 'Balance Sheet', icon: Landmark, featureFlag: 'balanceSheet' },
  { href: '/virtual-accounts', label: 'Virtual Accounts', icon: Wallet, featureFlag: 'virtualAccounts' },
  { href: '/yearly-report', label: 'Yearly Report', icon: Database, featureFlag: 'yearlyReport' },
  { href: '/ai-image-studio', label: 'AI Image Studio', icon: Wand2, featureFlag: 'aiImageStudio' },
  {
      label: 'Calculators',
      icon: Calculator,
      featureFlag: 'calculators',
      subItems: [
          { href: '/calculators/investment', label: 'Investment', icon: Building2 },
          { href: '/calculators/loan', label: 'Loan EMI', icon: DatabaseBackup },
          { href: '/calculators/returns', label: 'Returns', icon: DatabaseBackup },
      ]
  },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { 
    label: 'Admin', 
    icon: Shield,
    featureFlag: 'admin',
    subItems: [
        { href: '/admin/tenants', label: 'Tenants', icon: Building2 },
        { href: '/admin/default-categories', label: 'Default Categories', icon: Shapes },
        { href: '/admin/backup', label: 'Backup / Restore', icon: DatabaseBackup },
        { href: '/admin/logs', label: 'Audit Logs', icon: ScrollText, featureFlag: 'logs' },
    ]
  },
];


export function AppShellNav() {
  const pathname = usePathname();
  const { userTenant, isAdminUser } = useApp();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
      admin: false,
      calculators: false,
      borrowings: false,
  });
  const [isMounted, setIsMounted] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setOpenSections({
        admin: pathname.startsWith('/admin'),
        calculators: pathname.startsWith('/calculators'),
        borrowings: pathname.startsWith('/borrowings'),
    });
    setNavigatingTo(null);
  }, [pathname]);


  const navItems = useMemo(() => {
    if (!userTenant) return [];
    
    const filterItems = (items: NavItem[]): NavItem[] => {
      return items.reduce((acc: NavItem[], item: NavItem) => {
        if (item.featureFlag && item.featureFlag === 'admin' && !isAdminUser) {
          return acc;
        }

        if (item.featureFlag && userTenant.featureAccess?.[item.featureFlag] === false) {
           return acc;
        }

        if (hasSubItems(item)) {
          const filteredSubItems = item.subItems.filter(subItem => {
             if (!subItem.featureFlag) return true;
             return userTenant.featureAccess?.[subItem.featureFlag] ?? true; // Default to true if not explicitly set
          });
          if (filteredSubItems.length > 0) {
            acc.push({ ...item, subItems: filteredSubItems });
          }
        } else {
           if (!item.featureFlag || userTenant.featureAccess?.[item.featureFlag] !== false) {
             acc.push(item);
           }
        }
        return acc;
      }, []);
    };
    
    return filterItems(allNavItems);

  }, [userTenant, isAdminUser]);
  
  const toggleSection = (section: keyof typeof openSections) => {
      setOpenSections(prev => ({ ...prev, [section]: !prev[section]}));
  }
  
  if (!isMounted) {
      return null;
  }

  const handleNavClick = (href: string) => {
      if (pathname !== href) {
        setNavigatingTo(href);
      }
  };

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        const sectionKey = item.label.toLowerCase() as keyof typeof openSections;
        const isNavigating = navigatingTo === (hasHref(item) ? item.href : undefined);
        const isSectionActive = pathname.startsWith(`/${sectionKey}`);

        return hasSubItems(item) ? (
          <Collapsible key={item.label} open={openSections[sectionKey]} onOpenChange={() => toggleSection(sectionKey)}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                      className={cn(
                        "w-full justify-start",
                        isSectionActive ? 'text-primary font-bold' : 'text-muted-foreground'
                      )}
                      variant="ghost"
                  >
                    <>
                      <item.icon className={cn(isSectionActive && "text-primary")} />
                      <span>{item.label}</span>
                    </>
                  </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <div className="flex flex-col gap-1 ml-7 pl-3 border-l">
                  {item.subItems.map((subItem: NavItemWithHref) => {
                      const isSubItemNavigating = navigatingTo === subItem.href;
                      const isSubActive = pathname === subItem.href;
                      return (
                       <SidebarMenuItem key={subItem.href}>
                          <Link href={subItem.href} onClick={() => handleNavClick(subItem.href)}>
                              <SidebarMenuButton
                                  isActive={isSubActive}
                                  className={cn(
                                    "h-8",
                                    isSubActive ? "text-primary font-bold" : "text-muted-foreground"
                                  )}
                                  disabled={isSubItemNavigating}
                              >
                                  {isSubItemNavigating ? <Loader2 className="animate-spin" /> : <subItem.icon className={cn(isSubActive && "text-primary")} />}
                                  <span>{subItem.label}</span>
                              </SidebarMenuButton>
                          </Link>
                       </SidebarMenuItem>
                      )
                  })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <SidebarMenuItem key={item.href}>
             <Link href={hasHref(item) ? item.href : '#'} onClick={() => hasHref(item) && handleNavClick(item.href)}>
                  <SidebarMenuButton
                      isActive={pathname === item.href}
                      className={cn(
                        pathname === item.href ? "text-primary font-bold" : "text-muted-foreground"
                      )}
                      disabled={isNavigating}
                  >
                      {isNavigating ? <Loader2 className="animate-spin" /> : <item.icon className={cn(pathname === item.href && "text-primary")} />}
                       <span>{hasHref(item) && item.href === '/dashboard' && userTenant ? `Dashboard (${userTenant.name})` : item.label}</span>
                  </SidebarMenuButton>
             </Link>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  );
}
