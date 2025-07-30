/**
 * XP Component Showcase
 * Comprehensive demonstration of all UI components working together
 */

import React, { useState } from 'react';
import {
  Button,
  ButtonGroup,
  IconButton,
  ToolbarButton,
  Menu,
  MenuItem,
  MenuBar,
  ContextMenu,
  MenuSeparator,
  Dialog,
  MessageBox,
  PropertyDialog,
  TextInput,
  Checkbox,
  RadioButton,
  RadioGroup,
  Select,
  Textarea,
} from './index';

export const ComponentShowcase: React.FC = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subscribe: false,
    theme: 'blue',
    comments: '',
  });

  const menuBarItems = [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'new', label: 'New', shortcut: 'Ctrl+N', onClick: () => console.log('New') },
        { id: 'open', label: 'Open', shortcut: 'Ctrl+O', onClick: () => console.log('Open') },
        { id: 'separator1', separator: true },
        { id: 'exit', label: 'Exit', onClick: () => console.log('Exit') },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', onClick: () => console.log('Copy') },
        { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', onClick: () => console.log('Paste') },
      ],
    },
  ];

  const contextMenuItems = [
    { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
    { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
    { id: 'separator', separator: true },
    { id: 'properties', label: 'Properties' },
  ];

  const selectOptions = [
    { value: 'blue', label: 'Blue Theme' },
    { value: 'silver', label: 'Silver Theme' },
    { value: 'olive', label: 'Olive Theme' },
  ];

  const propertyTabs = [
    {
      id: 'general',
      label: 'General',
      content: (
        <div style={{ padding: '16px' }}>
          <TextInput
            label="Application Name"
            value="XP Desktop"
            readOnly
          />
          <Checkbox label="Start with Windows" checked />
          <Checkbox label="Show notifications" />
        </div>
      ),
    },
    {
      id: 'appearance',
      label: 'Appearance',
      content: (
        <div style={{ padding: '16px' }}>
          <Select
            label="Theme"
            options={selectOptions}
            value="blue"
          />
          <Checkbox label="Use large icons" />
          <Checkbox label="Show desktop icons" checked />
        </div>
      ),
    },
  ];

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Tahoma, sans-serif' }}>
      <h1 style={{ fontSize: '16px', marginBottom: '20px' }}>
        XP Component Showcase
      </h1>

      {/* Menu Bar */}
      <MenuBar
        items={menuBarItems}
        onItemSelect={(menuId, itemId) => console.log('Menu item selected:', menuId, itemId)}
      />

      {/* Button Showcase */}
      <section style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '12px', marginBottom: '10px' }}>Buttons</h2>
        
        <div style={{ marginBottom: '10px' }}>
          <Button variant="default" style={{ marginRight: '8px' }}>
            Default
          </Button>
          <Button variant="primary" style={{ marginRight: '8px' }}>
            Primary
          </Button>
          <Button variant="secondary" style={{ marginRight: '8px' }}>
            Secondary
          </Button>
          <Button disabled style={{ marginRight: '8px' }}>
            Disabled
          </Button>
          <Button loading>
            Loading
          </Button>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <ButtonGroup>
            <Button>First</Button>
            <Button>Second</Button>
            <Button>Third</Button>
          </ButtonGroup>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <IconButton
            icon={<span>🔍</span>}
            aria-label="Search"
            style={{ marginRight: '8px' }}
          />
          <ToolbarButton tooltip="Save">
            Save
          </ToolbarButton>
        </div>
      </section>

      {/* Form Showcase */}
      <section style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '12px', marginBottom: '10px' }}>Form Controls</h2>
        
        <div style={{ marginBottom: '10px' }}>
          <TextInput
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter your name"
            style={{ marginBottom: '8px' }}
          />
          
          <TextInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter your email"
            required
            style={{ marginBottom: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <Checkbox
            label="Subscribe to newsletter"
            checked={formData.subscribe}
            onChange={(e) => setFormData({ ...formData, subscribe: e.target.checked })}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <RadioGroup
            name="theme"
            value={formData.theme}
            onChange={(value) => setFormData({ ...formData, theme: value })}
          >
            <RadioButton value="blue" label="Blue Theme" />
            <RadioButton value="silver" label="Silver Theme" />
            <RadioButton value="olive" label="Olive Theme" />
          </RadioGroup>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <Select
            label="Preferred Theme"
            options={selectOptions}
            value={formData.theme}
            onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <Textarea
            label="Comments"
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            placeholder="Enter your comments..."
            rows={4}
          />
        </div>
      </section>

      {/* Dialog Showcase */}
      <section style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '12px', marginBottom: '10px' }}>Dialogs</h2>
        
        <div>
          <Button
            onClick={() => setShowDialog(true)}
            style={{ marginRight: '8px' }}
          >
            Show Dialog
          </Button>
          <Button
            onClick={() => setShowMessageBox(true)}
            style={{ marginRight: '8px' }}
          >
            Show Message Box
          </Button>
          <Button onClick={() => setShowPropertyDialog(true)}>
            Show Property Dialog
          </Button>
        </div>
      </section>

      {/* Context Menu Area */}
      <section
        style={{
          border: '2px inset #c0c0c0',
          padding: '20px',
          backgroundColor: '#f0f0f0',
          cursor: 'context-menu',
        }}
        onContextMenu={handleContextMenu}
      >
        <p style={{ fontSize: '10.67px', margin: 0 }}>
          Right-click here to show context menu
        </p>
      </section>

      {/* Dialogs */}
      {showDialog && (
        <Dialog
          isOpen={showDialog}
          title="Sample Dialog"
          onClose={() => setShowDialog(false)}
        >
          <div style={{ padding: '16px' }}>
            <p>This is a sample dialog with XP styling.</p>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <Button
                variant="primary"
                onClick={() => setShowDialog(false)}
                style={{ marginRight: '8px' }}
              >
                OK
              </Button>
              <Button onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {showMessageBox && (
        <MessageBox
          type="info"
          title="Information"
          message="This is a sample message box with authentic XP styling."
          buttons={[{ id: 'ok', label: 'OK', variant: 'primary' }]}
          onClose={() => setShowMessageBox(false)}
        />
      )}

      {showPropertyDialog && (
        <PropertyDialog
          isOpen={showPropertyDialog}
          title="Properties"
          tabs={propertyTabs}
          onOk={() => setShowPropertyDialog(false)}
          onCancel={() => setShowPropertyDialog(false)}
          showApply
        />
      )}

      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onItemSelect={(itemId) => {
            console.log('Context menu item selected:', itemId);
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
};
