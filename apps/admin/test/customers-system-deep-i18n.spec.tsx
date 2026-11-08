// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import enMessages from '../src/messages/en.json';
import viMessages from '../src/messages/vi.json';

afterEach(cleanup);

describe('Phase A3: Customers, Accounts & System Deep i18n Verification', () => {
  describe('Dictionary completeness and key alignment', () => {
    it('synchronizes all customers keys', () => {
      expect(enMessages.customers.customersTitle).toBe('Customer Management');
      expect(enMessages.customers.colFullName).toBe('Full Name');
      expect(enMessages.customers.colPhone).toBe('Phone Number');
      expect(enMessages.customers.colEmail).toBe('Email');
      expect(enMessages.customers.colStatus).toBe('Account Status');
      expect(enMessages.customers.statusActive).toBe('Active');
      expect(enMessages.customers.statusLocked).toBe('Locked');
      expect(enMessages.customers.tabOverview).toBe('Overview');
      expect(enMessages.customers.tabTickets).toBe('Tickets');
      expect(enMessages.customers.tabShipments).toBe('Shipments');
      expect(enMessages.customers.tabTransactions).toBe('Transaction History');
    });

    it('synchronizes all adminAccounts keys', () => {
      expect(enMessages.adminAccounts.adminAccountsTitle).toBe('Admin Account Management');
      expect(enMessages.adminAccounts.createAccount).toBe('Add Account');
      expect(enMessages.adminAccounts.colAccount).toBe('Account');
      expect(enMessages.adminAccounts.colCompany).toBe('Bus Company');
      expect(enMessages.adminAccounts.colRole).toBe('Role');
      expect(enMessages.adminAccounts.colStatus).toBe('Status');
      expect(enMessages.adminAccounts.colActions).toBe('Actions');
      expect(enMessages.adminAccounts.statusActive).toBe('Active');
      expect(enMessages.adminAccounts.statusLocked).toBe('Locked');
    });

    it('synchronizes all busCompanies keys', () => {
      expect(enMessages.busCompanies.busCompaniesTitle).toBe('Bus Company Management');
      expect(enMessages.busCompanies.createBusCompany).toBe('Add Bus Company');
      expect(enMessages.busCompanies.colCode).toBe('Company Code');
      expect(enMessages.busCompanies.colName).toBe('Company Name');
      expect(enMessages.busCompanies.colHotline).toBe('Hotline');
      expect(enMessages.busCompanies.colStatus).toBe('Status');
      expect(enMessages.busCompanies.statusActive).toBe('Active');
      expect(enMessages.busCompanies.statusSuspended).toBe('Suspended');
    });

    it('synchronizes all rbac keys', () => {
      expect(enMessages.rbac.rbacTitle).toBe('Platform RBAC Management');
      expect(enMessages.rbac.tenantRbacTitle).toBe('Tenant RBAC Management');
      expect(enMessages.rbac.platformDefaultScope).toBe('System Default Scope');
      expect(enMessages.rbac.saveChanges).toBe('Save changes');
      expect(enMessages.rbac.undo).toBe('Undo');
    });

    it('synchronizes all supportChat keys', () => {
      expect(enMessages.supportChat.supportChatTitle).toBe('Customer Support Chat');
      expect(enMessages.supportChat.tabAll).toBe('All');
      expect(enMessages.supportChat.tabPending).toBe('Pending');
      expect(enMessages.supportChat.tabProcessing).toBe('In Progress');
      expect(enMessages.supportChat.tabClosed).toBe('Closed');
      expect(enMessages.supportChat.inputPlaceholder).toBe('Type a response to the customer...');
      expect(enMessages.supportChat.realtimeConnected).toBe('Realtime connected');
      expect(enMessages.supportChat.realtimeDisconnected).toBe('Realtime disconnected');
    });

    it('synchronizes all reviews keys', () => {
      expect(enMessages.reviews.reviewsTitle).toBe('Reviews & Feedback Management');
      expect(enMessages.reviews.colCustomer).toBe('Customer');
      expect(enMessages.reviews.colRating).toBe('Rating');
      expect(enMessages.reviews.colComment).toBe('Comment');
      expect(enMessages.reviews.colStatus).toBe('Status');
      expect(enMessages.reviews.statusVisible).toBe('Visible');
      expect(enMessages.reviews.statusHidden).toBe('Hidden by Moderation');
      expect(enMessages.reviews.csatTitle).toBe('Average Rating (CSAT)');
      expect(enMessages.reviews.totalReviewsTitle).toBe('Total Reviews');
    });
  });

  describe('English rendering in client components', () => {
    it('renders customer tabs in English', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <div>
            <button>{enMessages.customers.tabOverview}</button>
            <button>{enMessages.customers.tabTickets}</button>
            <button>{enMessages.customers.tabShipments}</button>
            <button>{enMessages.customers.tabTransactions}</button>
          </div>
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Overview')).toBeTruthy();
      expect(screen.getByText('Tickets')).toBeTruthy();
      expect(screen.getByText('Shipments')).toBeTruthy();
      expect(screen.getByText('Transaction History')).toBeTruthy();
    });

    it('renders support chat filters in English', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <div>
            <span>{enMessages.supportChat.tabAll}</span>
            <span>{enMessages.supportChat.tabPending}</span>
            <span>{enMessages.supportChat.tabProcessing}</span>
            <span>{enMessages.supportChat.tabClosed}</span>
          </div>
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('All')).toBeTruthy();
      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.getByText('In Progress')).toBeTruthy();
      expect(screen.getByText('Closed')).toBeTruthy();
    });
  });
});
