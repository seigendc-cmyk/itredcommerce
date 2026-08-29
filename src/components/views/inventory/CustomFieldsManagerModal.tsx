import React, { useState } from 'react';
import { 
  Sliders, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  HelpCircle, 
  Search, 
  Filter, 
  Asterisk, 
  Sparkles,
  Info
} from 'lucide-react';
import { CustomFieldDefinition, CustomFieldType } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

export interface CustomFieldsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customFieldDefs: CustomFieldDefinition[];
  onSaveCustomFieldDefs: (defs: CustomFieldDefinition[]) => void;
  currentIndustry?: string;
}

export const CustomFieldsManagerModal: React.FC<CustomFieldsManagerModalProps> = ({
  isOpen,
  onClose,
  customFieldDefs,
  onSaveCustomFieldDefs,
  currentIndustry = 'Motor Spares',
}) => {
  const [fields, setFields] = useState<CustomFieldDefinition[]>(customFieldDefs);
  const [selectedIndustry, setSelectedIndustry] = useState<string>(currentIndustry);

  // New field form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<CustomFieldType>('text');
  const [newOptionsText, setNewOptionsText] = useState('');
  const [newIsSearchable, setNewIsSearchable] = useState(true);
  const [newIsFilterable, setNewIsFilterable] = useState(true);
  const [newIsRequired, setNewIsRequired] = useState(false);
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  const industries = [
    'Motor Spares',
    'Hardware & Mechanical',
    'Fasteners & Fixtures',
    'Lubricants & Fluids',
    'Safety Equipment',
    'Pneumatics & Hydraulics',
    'Electrical & Power',
    'Plumbing & Piping',
    'Grocery & Provisions',
    'Pharmacy & Health',
    'Agriculture & Veterinary',
    'Clothing & Workwear',
    'General Dealers & Supplies',
  ];

  const filteredFields = fields.filter((f) => f.industry === selectedIndustry || f.industry === 'Universal');

  const handleAddNewField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const id = newLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
    const options = (newType === 'select' || newType === 'multi-select') && newOptionsText.trim()
      ? newOptionsText.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const newField: CustomFieldDefinition = {
      id: `${id}_${Date.now()}`,
      label: newLabel.trim(),
      industry: selectedIndustry,
      type: newType,
      options,
      isSearchable: newIsSearchable,
      isFilterable: newIsFilterable,
      isRequired: newIsRequired,
      placeholder: newPlaceholder.trim() || undefined,
    };

    const updated = [...fields, newField];
    setFields(updated);
    setIsAddingNew(false);
    setNewLabel('');
    setNewOptionsText('');
    setNewPlaceholder('');
    setAlertNotice(`Added field "${newField.label}" to ${selectedIndustry}.`);
    setTimeout(() => setAlertNotice(null), 2500);
  };

  const handleDeleteField = (id: string) => {
    const updated = fields.filter((f) => f.id !== id);
    setFields(updated);
  };

  const handleSaveAndApply = () => {
    onSaveCustomFieldDefs(fields);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Additional Item Fields"
      subtitle="Define Sector-Specific Item Specifications & Search Attributes"
      maxWidth="lg"
      headerColor="orange"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveAndApply} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
            Save & Apply Field Definitions
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs select-none">
        {/* Informational Callout */}
        <Alert type="info" size="sm">
          <strong>Configurable Item Metadata</strong>: Defined fields will appear in the "Additional Item Fields" section of the Product Master for items categorized in the selected industry.
        </Alert>

        {alertNotice && (
          <Alert type="success" size="sm" onClose={() => setAlertNotice(null)}>
            {alertNotice}
          </Alert>
        )}

        {/* Industry Filter Selector */}
        <div className="flex items-center justify-between gap-3 bg-gray-50 p-2.5 border border-gray-200">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-0.5">
              Sector / Industry Template:
            </label>
            <select
              value={selectedIndustry}
              onChange={(e) => {
                setSelectedIndustry(e.target.value);
                setIsAddingNew(false);
              }}
              className="p-1.5 bg-white border border-gray-300 font-bold text-gray-900 text-xs focus:outline-none focus:border-[#FF6B00]"
            >
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind} ({fields.filter((f) => f.industry === ind).length} fields defined)
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddingNew(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            + Add Field
          </Button>
        </div>

        {/* Add New Field Drawer / Form */}
        {isAddingNew && (
          <form onSubmit={handleAddNewField} className="p-3.5 bg-white border-2 border-[#FF6B00] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="font-bold text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#FF6B00]" />
                New Specification Field for {selectedIndustry}
              </span>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="text-gray-500 hover:text-gray-900 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Field Label / Name"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Engine Code, Thread Size, Dosage Form"
                required
              />

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Field Input Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as CustomFieldType)}
                  className="w-full p-2 bg-white border border-gray-300 font-medium text-xs focus:outline-none focus:border-[#FF6B00]"
                >
                  <option value="text">Text (Single Line String)</option>
                  <option value="number">Number (Integer / Count)</option>
                  <option value="decimal">Decimal (Measurement / Precision)</option>
                  <option value="date">Date (Calendar Date)</option>
                  <option value="boolean">Yes / No (Boolean Toggle)</option>
                  <option value="select">Select (Single Dropdown Choice)</option>
                  <option value="multi-select">Multi Select (Multiple Tag Choices)</option>
                </select>
              </div>
            </div>

            {(newType === 'select' || newType === 'multi-select') && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Preset Choices / Options (Comma-Separated)
                </label>
                <input
                  type="text"
                  value={newOptionsText}
                  onChange={(e) => setNewOptionsText(e.target.value)}
                  placeholder="e.g. Option A, Option B, Option C"
                  className="w-full p-2 bg-white border border-gray-300 font-mono text-xs focus:outline-none focus:border-[#FF6B00]"
                  required
                />
              </div>
            )}

            <Input
              label="Placeholder / Help Text (Optional)"
              value={newPlaceholder}
              onChange={(e) => setNewPlaceholder(e.target.value)}
              placeholder="e.g. Enter OEM part number format (XXXXX-XXXXX)"
            />

            {/* Designations */}
            <div className="p-2.5 bg-gray-50 border border-gray-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block mb-2">
                Field Capabilities & Constraints
              </span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsSearchable}
                    onChange={(e) => setNewIsSearchable(e.target.checked)}
                    className="accent-[#FF6B00]"
                  />
                  <span className="text-xs text-gray-800 font-medium flex items-center gap-1">
                    <Search className="w-3 h-3 text-gray-500" />
                    Searchable in POS & Catalog
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsFilterable}
                    onChange={(e) => setNewIsFilterable(e.target.checked)}
                    className="accent-[#FF6B00]"
                  />
                  <span className="text-xs text-gray-800 font-medium flex items-center gap-1">
                    <Filter className="w-3 h-3 text-gray-500" />
                    Filterable in Item List
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsRequired}
                    onChange={(e) => setNewIsRequired(e.target.checked)}
                    className="accent-[#FF6B00]"
                  />
                  <span className="text-xs text-gray-800 font-medium flex items-center gap-1">
                    <Asterisk className="w-3 h-3 text-rose-500" />
                    Required on Item Save
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddingNew(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Create Field Definition
              </Button>
            </div>
          </form>
        )}

        {/* Existing Defined Fields List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
              Active Fields ({filteredFields.length}) for {selectedIndustry}
            </span>
          </div>

          {filteredFields.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-gray-300 bg-gray-50 text-gray-500">
              No custom specification fields configured yet for {selectedIndustry}.
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => setIsAddingNew(true)}>
                  Define First Custom Field
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 border border-gray-200 bg-white max-h-[300px] overflow-y-auto">
              {filteredFields.map((field) => (
                <div key={field.id} className="p-2.5 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{field.label}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-gray-100 text-gray-700 border border-gray-300">
                        {field.type}
                      </span>
                      {field.isRequired && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          REQUIRED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1 font-mono">
                      {field.isSearchable && <span>• Searchable</span>}
                      {field.isFilterable && <span>• Filterable</span>}
                      {field.options && <span>• Options: {field.options.slice(0, 3).join(', ')}{field.options.length > 3 ? '...' : ''}</span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteField(field.id)}
                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Remove Field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
