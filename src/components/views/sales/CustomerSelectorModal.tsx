import React, { useState } from 'react';
import { 
  User, 
  Search, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  Building2, 
  Phone, 
  CreditCard,
  Lock,
  Clock,
  Ban
} from 'lucide-react';
import { Customer, StaffMember } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

export interface CustomerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customer: Customer) => void;
  onAddNewCustomer: (newCustomer: Customer) => void;
  currentStaff: StaffMember;
}

export const CustomerSelectorModal: React.FC<CustomerSelectorModalProps> = ({
  isOpen,
  onClose,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onAddNewCustomer,
  currentStaff,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newTaxNumber, setNewTaxNumber] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Search filter
  const filteredCustomers = customers.filter((cust) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      cust.name.toLowerCase().includes(q) ||
      cust.accountNumber.toLowerCase().includes(q) ||
      (cust.companyName && cust.companyName.toLowerCase().includes(q)) ||
      cust.phone.includes(q) ||
      (cust.email && cust.email.toLowerCase().includes(q))
    );
  });

  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError('Customer Name is required.');
      return;
    }
    if (!newPhone.trim()) {
      setFormError('Phone number is required for customer verification.');
      return;
    }

    const randId = Math.floor(1000 + Math.random() * 9000);
    const created: Customer = {
      id: `CUST-${randId}`,
      accountNumber: `ACC-${randId}`,
      name: newName.trim(),
      companyName: newCompany.trim() || undefined,
      phone: newPhone.trim(),
      email: newEmail.trim() || undefined,
      address: newAddress.trim() || undefined,
      taxNumber: newTaxNumber.trim() || undefined,
      status: 'PENDING_APPROVAL', // MANDATORY: Cashier created customers receive Pending Approval
      isCreditApproved: false,
      creditLimit: 0,
      currentBalance: 0,
      availableCredit: 0,
      createdDate: new Date().toISOString().slice(0, 10),
      createdByStaffId: currentStaff.id,
      notes: newNotes.trim() || `Registered at POS by ${currentStaff.name}. Pending credit approval.`,
    };

    onAddNewCustomer(created);
    onSelectCustomer(created);
    setIsCreatingNew(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreatingNew ? 'Register New Customer Account' : 'Select Customer Account'}
      subtitle={isCreatingNew ? 'Cashier Registration • Pending Management Approval' : 'Commercial Ledger & Walk-in Profile Selection'}
      maxWidth="lg"
      headerColor="orange"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => isCreatingNew ? setIsCreatingNew(false) : onClose()}>
            {isCreatingNew ? 'Back to Customer List' : 'Cancel'}
          </Button>
          {!isCreatingNew && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreatingNew(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              + Register New Customer
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3.5 text-xs select-none">
        {isCreatingNew ? (
          /* New Customer Registration Form */
          <form onSubmit={handleCreateCustomerSubmit} className="space-y-3">
            <Alert type="warning" size="sm">
              <strong>Cashier Account Notice:</strong> New accounts registered at the POS terminal are assigned <strong>Pending Approval</strong> status. A Store Manager must verify the company profile before credit facilities can be enabled.
            </Alert>

            {formError && (
              <Alert type="error" size="sm" onClose={() => setFormError(null)}>
                {formError}
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Customer / Contact Name *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Tendai Chikore"
                required
              />

              <Input
                label="Company / Trading Name"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="e.g. Chikore Transport Services"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Phone Number *"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="e.g. +1 (555) 302-8819"
                required
              />

              <Input
                label="Email Address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. tendai@chikoretrans.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Physical Address / Workshop"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="e.g. Stand 45, Graniteside Industrial"
              />

              <Input
                label="Tax / VAT Number"
                value={newTaxNumber}
                onChange={(e) => setNewTaxNumber(e.target.value)}
                placeholder="e.g. VAT-882910"
              />
            </div>

            {/* Credit Authorization Lock Notice */}
            <div className="p-3 bg-gray-50 border border-gray-300 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-gray-700">
                <span className="flex items-center gap-1 font-bold text-gray-800">
                  <Lock className="w-3.5 h-3.5 text-gray-500" />
                  Credit Facility Authorization:
                </span>
                <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 border border-amber-300">
                  Pending Manager Review ($0.00 Initial Limit)
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-sans">
                Cashiers cannot authorize credit lines. Cash, Mobile Money, and Card tenders remain immediately accessible.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Cashier Registration Notes
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
                placeholder="Reason for account opening, referral details, or fleet vehicle registrations..."
                className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <Button variant="outline" size="sm" onClick={() => setIsCreatingNew(false)}>
                Back to List
              </Button>
              <Button variant="primary" size="sm" type="submit" leftIcon={<CheckCircle2 className="w-4 h-4" />}>
                Create Account & Select for Cart
              </Button>
            </div>
          </form>
        ) : (
          /* Customer List & Search */
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, account number, company, or phone..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 font-medium text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#FF6B00]"
                autoFocus
              />
            </div>

            <div className="divide-y divide-gray-200 border border-gray-300 bg-white max-h-[340px] overflow-y-auto">
              {filteredCustomers.map((cust) => {
                const isSelected = cust.id === selectedCustomerId;
                const isSuspended = cust.status === 'SUSPENDED';
                const isPending = cust.status === 'PENDING_APPROVAL';

                return (
                  <div
                    key={cust.id}
                    onClick={() => {
                      onSelectCustomer(cust);
                      onClose();
                    }}
                    className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50/80 border-l-4 border-l-[#FF6B00]'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-xs">
                          {cust.name}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1 border border-gray-200">
                          {cust.accountNumber}
                        </span>
                        
                        {/* Status Badge */}
                        {isPending && (
                          <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.2 border border-amber-300 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            Pending Approval
                          </span>
                        )}
                        {isSuspended && (
                          <span className="text-[9px] font-bold uppercase bg-rose-100 text-rose-800 px-1.5 py-0.2 border border-rose-300 flex items-center gap-0.5">
                            <Ban className="w-2.5 h-2.5" />
                            Suspended
                          </span>
                        )}
                      </div>

                      {cust.companyName && (
                        <div className="text-[11px] text-gray-600 flex items-center gap-1 font-medium">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          {cust.companyName}
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-gray-500 flex items-center gap-3">
                        <span>Tel: {cust.phone}</span>
                        {cust.email && <span>Email: {cust.email}</span>}
                      </div>
                    </div>

                    {/* Commercial Credit Summary Pill */}
                    <div className="text-right font-mono text-[11px] shrink-0 pl-3">
                      {cust.isCreditApproved ? (
                        <div>
                          <div className="text-gray-500 text-[10px]">
                            Avail Credit: <strong className="text-emerald-700">${cust.availableCredit.toFixed(2)}</strong>
                          </div>
                          <div className="text-[9px] text-gray-400">
                            Limit: ${cust.creditLimit.toFixed(2)} • Bal: ${cust.currentBalance.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">
                          {cust.id === 'CUST-WALKIN' ? 'Cash / Direct Only' : 'No Credit Authorized'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
