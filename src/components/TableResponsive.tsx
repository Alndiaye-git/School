import React from 'react';
import { useResponsive } from '../hooks/useResponsive';

interface Column {
  key: string;
  label: string;
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface TableResponsiveProps {
  data: any[];
  columns: Column[];
  keyField: string;
  actions?: (row: any) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

const TableResponsive: React.FC<TableResponsiveProps> = ({
  data,
  columns,
  keyField,
  actions,
  emptyMessage = "Aucune donnée disponible",
  className = ""
}) => {
  const { isMobile } = useResponsive();

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  if (isMobile) {
    // Affichage en cartes sur mobile
    return (
      <div className={`mobile-cards ${className}`}>
        {data.map((row) => (
          <div key={row[keyField]} className="mobile-card">
            <div className="mobile-card-content">
              {columns.map((column) => {
                const value = row[column.key];
                const displayValue = column.render ? column.render(value, row) : value;
                
                if (!displayValue && displayValue !== 0) return null;
                
                return (
                  <div key={column.key} className="mobile-card-row">
                    <span className="mobile-card-label">{column.label}:</span>
                    <span className="mobile-card-value">{displayValue}</span>
                  </div>
                );
              })}
            </div>
            {actions && (
              <div className="mobile-card-actions">
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Affichage en table sur desktop/tablet
  return (
    <div className={`table-moderne ${className}`}>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width }}>
                {column.label}
              </th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[keyField]}>
              {columns.map((column) => {
                const value = row[column.key];
                const displayValue = column.render ? column.render(value, row) : value;
                
                return (
                  <td key={column.key}>
                    {displayValue}
                  </td>
                );
              })}
              {actions && (
                <td className="actions-cell">
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableResponsive;