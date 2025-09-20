// Salesforce API Integration Example
// This will work with Supabase Edge Functions when connected

interface SalesforceConfig {
  instanceUrl: string;
  accessToken: string;
  clientId: string;
  clientSecret: string;
}

interface Lead {
  FirstName: string;
  LastName: string;
  Company: string;
  Email: string;
  Phone?: string;
  Status: string;
  LeadSource: string;
}

interface Opportunity {
  Name: string;
  AccountId: string;
  StageName: string;
  CloseDate: string;
  Amount?: number;
}

interface Contact {
  FirstName: string;
  LastName: string;
  AccountId: string;
  Email: string;
  Phone?: string;
}

export class SalesforceAPI {
  private config: SalesforceConfig;

  constructor(config: SalesforceConfig) {
    this.config = config;
  }

  // Authenticate with Salesforce OAuth
  static async authenticate(clientId: string, clientSecret: string, username: string, password: string, securityToken: string) {
    const loginUrl = 'https://login.salesforce.com/services/oauth2/token';
    
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username: username,
      password: password + securityToken
    });

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        instanceUrl: data.instance_url,
        tokenType: data.token_type
      };
    } catch (error) {
      console.error('Salesforce authentication error:', error);
      throw error;
    }
  }

  // Create a new Lead
  async createLead(leadData: Lead): Promise<string> {
    const url = `${this.config.instanceUrl}/services/data/v58.0/sobjects/Lead/`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create lead: ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  }

  // Get Lead by ID
  async getLead(leadId: string): Promise<any> {
    const url = `${this.config.instanceUrl}/services/data/v58.0/sobjects/Lead/${leadId}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get lead: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting lead:', error);
      throw error;
    }
  }

  // Search Leads with SOQL
  async searchLeads(query: string): Promise<any[]> {
    const encodedQuery = encodeURIComponent(query);
    const url = `${this.config.instanceUrl}/services/data/v58.0/query/?q=${encodedQuery}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search leads: ${response.statusText}`);
      }

      const result = await response.json();
      return result.records;
    } catch (error) {
      console.error('Error searching leads:', error);
      throw error;
    }
  }

  // Create Opportunity
  async createOpportunity(opportunityData: Opportunity): Promise<string> {
    const url = `${this.config.instanceUrl}/services/data/v58.0/sobjects/Opportunity/`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(opportunityData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create opportunity: ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Error creating opportunity:', error);
      throw error;
    }
  }

  // Create Contact
  async createContact(contactData: Contact): Promise<string> {
    const url = `${this.config.instanceUrl}/services/data/v58.0/sobjects/Contact/`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create contact: ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  // Create Event (Meeting)
  async createEvent(eventData: {
    Subject: string;
    StartDateTime: string;
    EndDateTime: string;
    WhoId?: string; // Contact or Lead ID
    WhatId?: string; // Account or Opportunity ID
    Description?: string;
    Location?: string;
  }): Promise<string> {
    const url = `${this.config.instanceUrl}/services/data/v58.0/sobjects/Event/`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  // Get Dashboard Data
  async getDashboardData(): Promise<{
    leads: number;
    opportunities: number;
    contacts: number;
    events: number;
  }> {
    try {
      const queries = [
        "SELECT COUNT() FROM Lead WHERE CreatedDate = TODAY",
        "SELECT COUNT() FROM Opportunity WHERE CreatedDate = TODAY",
        "SELECT COUNT() FROM Contact WHERE CreatedDate = TODAY",
        "SELECT COUNT() FROM Event WHERE CreatedDate = TODAY"
      ];

      const results = await Promise.all(
        queries.map(query => this.executeQuery(query))
      );

      return {
        leads: results[0].totalSize,
        opportunities: results[1].totalSize,
        contacts: results[2].totalSize,
        events: results[3].totalSize
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  // Execute SOQL Query
  private async executeQuery(query: string): Promise<any> {
    const encodedQuery = encodeURIComponent(query);
    const url = `${this.config.instanceUrl}/services/data/v58.0/query/?q=${encodedQuery}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Example usage with Supabase Edge Function
export const salesforceService = {
  // This function should be called from a Supabase Edge Function
  async initializeWithSupabase(supabaseUrl: string, apiKey: string) {
    // Call Supabase Edge Function that handles Salesforce authentication
    const response = await fetch(`${supabaseUrl}/functions/v1/salesforce-auth`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'authenticate'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate with Salesforce');
    }

    return await response.json();
  },

  async createLeadViaSupabase(leadData: Lead, supabaseUrl: string, apiKey: string) {
    const response = await fetch(`${supabaseUrl}/functions/v1/salesforce-crm`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_lead',
        data: leadData
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create lead');
    }

    return await response.json();
  }
};