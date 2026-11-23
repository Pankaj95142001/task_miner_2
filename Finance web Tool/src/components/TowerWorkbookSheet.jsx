import { useEffect, useMemo, useState } from 'react';

const EMPTY_INPUTS = Object.freeze({});

function textValue(value) {
  return String(value ?? '');
}

function trimmedValue(value) {
  return textValue(value).trim();
}

function parseAddress(address) {
  const match = /^([A-Z]+)(\d+)$/i.exec(String(address || '').trim());
  if (!match) {
    return { column: '', rowNumber: 0 };
  }

  return {
    column: match[1].toUpperCase(),
    rowNumber: Number(match[2]),
  };
}

function overlayWorkbookInputs(snapshot, inputs) {
  if (!snapshot || !Array.isArray(snapshot.rows)) {
    return snapshot;
  }

  const overrides = inputs && typeof inputs === 'object' ? inputs : {};

  return {
    ...snapshot,
    rows: snapshot.rows.map((row) =>
      row.map((cell) => {
        if (!cell?.isInput || !Object.prototype.hasOwnProperty.call(overrides, cell.address)) {
          return cell;
        }

        return {
          ...cell,
          text: String(overrides[cell.address] ?? ''),
        };
      }),
    ),
  };
}

function looksNumeric(value) {
  const text = trimmedValue(value);
  return text ? /^\(?-?\$?[\d,.]+%?\)?$/.test(text) : false;
}

function classifySingleCellText(text) {
  const normalized = trimmedValue(text);
  if (!normalized) {
    return 'blank';
  }

  if (normalized.length > 140) {
    return 'note';
  }

  if (/^(?:\d{2}\.|SECTION\b)/i.test(normalized)) {
    return 'sectionTitle';
  }

  if (/^[A-Z0-9 &/(),:%._\-]+$/.test(normalized) && normalized.length >= 6 && normalized.length <= 120) {
    return 'sectionTitle';
  }

  return 'note';
}

function classifyWorkbookRow(row, rowIndex) {
  const cells = Array.isArray(row)
    ? row.map((cell, columnIndex) => {
        const addressMeta = parseAddress(cell?.address);
        return {
          ...cell,
          columnIndex,
          column: addressMeta.column,
          rowNumber: addressMeta.rowNumber,
        };
      })
    : [];

  const nonEmptyCells = cells.filter((cell) => trimmedValue(cell?.text) || trimmedValue(cell?.formula));
  const rowNumber = cells.find((cell) => cell.rowNumber)?.rowNumber || rowIndex + 1;

  if (nonEmptyCells.length === 0) {
    return { kind: 'blank', rowNumber, cells, primaryText: '' };
  }

  if (nonEmptyCells.length === 1 && !nonEmptyCells[0].isInput && !nonEmptyCells[0].hasFormula) {
    const onlyText = trimmedValue(nonEmptyCells[0].text);
    return {
      kind: classifySingleCellText(onlyText),
      rowNumber,
      cells,
      primaryText: onlyText,
    };
  }

  return { kind: 'grid', rowNumber, cells, primaryText: '' };
}

function createSection(title, rowNumber, indexSeed) {
  return {
    id: `section-${rowNumber || indexSeed}`,
    title: trimmedValue(title) || `Workbook Section ${indexSeed}`,
    titleRowNumber: rowNumber || 0,
    rows: [],
  };
}

function finalizeSection(section, columnLabels) {
  const editableCellCount = section.rows.reduce(
    (total, row) => total + row.cells.filter((cell) => cell?.isInput).length,
    0,
  );
  const formulaCellCount = section.rows.reduce(
    (total, row) => total + row.cells.filter((cell) => cell?.hasFormula).length,
    0,
  );
  const nonBlankRows = section.rows.filter((row) => row.kind !== 'blank');
  const startRow = nonBlankRows[0]?.rowNumber || section.titleRowNumber || 0;
  const endRow = nonBlankRows[nonBlankRows.length - 1]?.rowNumber || startRow;

  return {
    ...section,
    columnLabels,
    editableCellCount,
    formulaCellCount,
    startRow,
    endRow,
  };
}

function buildWorkbookSections(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.rows) || snapshot.rows.length === 0) {
    return [];
  }

  const columnLabels = (snapshot.rows[0] || []).map((cell) => parseAddress(cell?.address).column || '');
  const rowMetas = snapshot.rows.map((row, index) => classifyWorkbookRow(row, index));
  const sections = [];
  let currentSection = null;
  let untitledCounter = 1;

  rowMetas.forEach((rowMeta) => {
    if (rowMeta.kind === 'sectionTitle') {
      if (currentSection && currentSection.rows.length) {
        sections.push(finalizeSection(currentSection, columnLabels));
      }

      currentSection = createSection(rowMeta.primaryText, rowMeta.rowNumber, untitledCounter);
      untitledCounter += 1;
      return;
    }

    if (!currentSection) {
      currentSection = createSection(snapshot.sheetName || 'Workbook', rowMeta.rowNumber, untitledCounter);
      untitledCounter += 1;
    }

    currentSection.rows.push(rowMeta);
  });

  if (currentSection && currentSection.rows.length) {
    sections.push(finalizeSection(currentSection, columnLabels));
  }

  if (!sections.length) {
    return [finalizeSection(createSection(snapshot.sheetName || 'Workbook', 1, 1), columnLabels)];
  }

  return sections;
}

function findCellInSection(section, address) {
  if (!section || !address) {
    return null;
  }

  for (const row of section.rows) {
    const matched = row.cells.find((cell) => cell.address === address);
    if (matched) {
      return matched;
    }
  }

  return null;
}

function findFirstSelectableCell(section) {
  if (!section) {
    return null;
  }

  for (const priority of [
    (cell) => cell.isInput,
    (cell) => cell.hasFormula,
    (cell) => trimmedValue(cell.text),
  ]) {
    for (const row of section.rows) {
      const matched = row.cells.find(priority);
      if (matched) {
        return matched;
      }
    }
  }

  return null;
}

function cellDisplayValue(cell, draftInputs) {
  if (!cell) {
    return '';
  }

  if (cell.isInput && Object.prototype.hasOwnProperty.call(draftInputs, cell.address)) {
    return String(draftInputs[cell.address] ?? '');
  }

  return textValue(cell.text);
}

function workbookCellKind(cell) {
  if (!cell) {
    return 'Blank';
  }

  if (cell.isInput) {
    return 'Editable input';
  }

  if (cell.hasFormula) {
    return 'Excel formula';
  }

  return 'Workbook text';
}

function WorkbookValueButton({ cell, value, isSelected, onSelect }) {
  return (
    <button
      type='button'
      className={['fpa-workbook-cell-button', isSelected ? 'is-selected' : ''].filter(Boolean).join(' ')}
      onClick={() => onSelect(cell)}
      title={cell.hasFormula ? `${cell.address} | ${cell.formula}` : cell.address}
    >
      {value || '\u00A0'}
    </button>
  );
}

function WorkbookGridRow({ row, draftInputs, canEdit, isBusy, selectedAddress, onSelectCell, onDraftChange, onDraftCommit }) {
  return (
    <tr className='fpa-workbook-row'>
      <td className='fpa-workbook-row-index'>{row.rowNumber}</td>
      {row.cells.map((cell) => {
        const value = cellDisplayValue(cell, draftInputs);
        const classes = ['fpa-workbook-cell'];

        if (cell?.isInput) {
          classes.push('is-input');
        }
        if (cell?.hasFormula) {
          classes.push('is-formula');
        }
        if (!trimmedValue(value) && !trimmedValue(cell?.formula)) {
          classes.push('is-empty');
        }
        if (looksNumeric(value)) {
          classes.push('is-number');
        }
        if (selectedAddress === cell.address) {
          classes.push('is-selected');
        }

        return (
          <td key={cell.address} className={classes.join(' ')}>
            {cell.isInput ? (
              <input
                type='text'
                className='fpa-workbook-input'
                value={value}
                disabled={!canEdit || isBusy}
                onFocus={() => onSelectCell(cell)}
                onChange={(event) => onDraftChange(cell.address, event.target.value)}
                onBlur={(event) => onDraftCommit(cell.address, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <WorkbookValueButton
                cell={cell}
                value={value}
                isSelected={selectedAddress === cell.address}
                onSelect={onSelectCell}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}

function WorkbookSectionTable({ section, draftInputs, canEdit, isBusy, selectedAddress, onSelectCell, onDraftChange, onDraftCommit }) {
  return (
    <div className='fpa-table-wrap fpa-workbook-wrap'>
      <table className='fpa-table fpa-workbook-table'>
        <thead>
          <tr>
            <th className='fpa-workbook-row-index-head'>Row</th>
            {section.columnLabels.map((label, index) => (
              <th key={`${section.id}-col-${label || index}`} className='fpa-workbook-col-head'>{label || `Col ${index + 1}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => {
            if (row.kind === 'blank') {
              return (
                <tr key={`${section.id}-row-${row.rowNumber}`} className='fpa-workbook-row is-blank'>
                  <td className='fpa-workbook-row-index'>{row.rowNumber}</td>
                  <td className='fpa-workbook-row-spacer' colSpan={section.columnLabels.length} />
                </tr>
              );
            }

            if (row.kind === 'note') {
              return (
                <tr key={`${section.id}-row-${row.rowNumber}`} className='fpa-workbook-row is-note'>
                  <td className='fpa-workbook-row-index'>{row.rowNumber}</td>
                  <td className='fpa-workbook-row-note' colSpan={section.columnLabels.length}>{row.primaryText}</td>
                </tr>
              );
            }

            return (
              <WorkbookGridRow
                key={`${section.id}-row-${row.rowNumber}`}
                row={row}
                draftInputs={draftInputs}
                canEdit={canEdit}
                isBusy={isBusy}
                selectedAddress={selectedAddress}
                onSelectCell={onSelectCell}
                onDraftChange={onDraftChange}
                onDraftCommit={onDraftCommit}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TowerWorkbookSheet({
  activeTab,
  currentDeal,
  currentUserId,
  canEdit,
  isBusy,
  onUpdateCell,
  towerLabel = 'Tower',
  workbookInputsBySheet = null,
  renderWorkbookSheet,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [selectedCellAddress, setSelectedCellAddress] = useState('');

  const sheetName = activeTab?.sheetName || '';
  const workbookInputs = workbookInputsBySheet?.[sheetName] || EMPTY_INPUTS;
  const workbookInputsKey = useMemo(() => JSON.stringify(workbookInputs), [workbookInputs]);
  const [draftInputs, setDraftInputs] = useState(() => ({ ...workbookInputs }));

  useEffect(() => {
    setDraftInputs({ ...workbookInputs });
  }, [workbookInputsKey]);

  useEffect(() => {
    let isCancelled = false;

    async function loadSnapshot() {
      if (!sheetName || !currentDeal || typeof renderWorkbookSheet !== 'function') {
        if (!isCancelled) {
          setSnapshot(null);
          setError('');
        }
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const nextSnapshot = await renderWorkbookSheet(sheetName, currentDeal, currentUserId);
        if (!isCancelled) {
          setSnapshot(nextSnapshot);
        }
      } catch (nextError) {
        if (!isCancelled) {
          setError(nextError.message || `Unable to render the workbook-backed ${towerLabel} sheet.`);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [sheetName, currentDeal?.id, currentUserId, refreshNonce, workbookInputsKey, renderWorkbookSheet, towerLabel]);

  const displaySnapshot = useMemo(
    () => overlayWorkbookInputs(snapshot, { ...workbookInputs, ...draftInputs }),
    [snapshot, workbookInputs, draftInputs],
  );
  const sections = useMemo(() => buildWorkbookSections(displaySnapshot), [displaySnapshot]);

  useEffect(() => {
    if (!sections.length) {
      setActiveSectionId('');
      return;
    }

    if (!sections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(sections[0].id);
    }
  }, [sections, activeSectionId]);

  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0] || null;
  const activeSectionIndex = activeSection ? sections.findIndex((section) => section.id === activeSection.id) : -1;
  const previousSection = activeSectionIndex > 0 ? sections[activeSectionIndex - 1] : null;
  const nextSection = activeSectionIndex >= 0 && activeSectionIndex < sections.length - 1 ? sections[activeSectionIndex + 1] : null;

  useEffect(() => {
    if (!activeSection) {
      setSelectedCellAddress('');
      return;
    }

    if (selectedCellAddress && findCellInSection(activeSection, selectedCellAddress)) {
      return;
    }

    const nextCell = findFirstSelectableCell(activeSection);
    setSelectedCellAddress(nextCell?.address || '');
  }, [activeSection, selectedCellAddress]);

  const selectedCell = activeSection ? findCellInSection(activeSection, selectedCellAddress) : null;
  const selectedCellValue = selectedCell ? cellDisplayValue(selectedCell, draftInputs) : '';
  const totalEditableCells = displaySnapshot?.editableCellCount || sections.reduce((total, section) => total + section.editableCellCount, 0);
  const totalFormulaCells = displaySnapshot?.formulaCellCount || sections.reduce((total, section) => total + section.formulaCellCount, 0) || activeTab?.formulaCount || 0;

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(address, value) {
    const nextValue = value == null ? '' : String(value);
    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextValue,
    }));
    onUpdateCell(sheetName, address, nextValue);
  }

  return (
    <div className='fpa-form-stack fpa-workbook-layout'>
      <section className='compact-card fpa-subpanel fpa-workbook-hero'>
        <div className='step-header'>
          <div>
            <span className='step-badge'>Excel Parity</span>
            <h4>Exact workbook-backed tab</h4>
            <p className='section-note'>This {towerLabel} tab is rendered from the source Excel workbook. Inputs save to the deal, and formulas recalculate from the live workbook on refresh and after committed edits.</p>
          </div>
          <div className='fpa-tab-meta'>
            <span className='section-chip'>{sections.length || 0} sections</span>
            <span className='section-chip'>{totalEditableCells} editable cells</span>
            <span className='section-chip'>{totalFormulaCells} formulas</span>
          </div>
        </div>

        <div className='fpa-workbook-toolbar'>
          <label className='fpa-workbook-picker'>
            <span>Workbook Section</span>
            <select
              className='fpa-workbook-select'
              value={activeSectionId}
              onChange={(event) => setActiveSectionId(event.target.value)}
              disabled={!sections.length}
            >
              {sections.map((section, index) => (
                <option key={section.id} value={section.id}>{String(index + 1).padStart(2, '0')} | {section.title}</option>
              ))}
            </select>
          </label>

          <div className='fpa-workbook-toolbar-actions'>
            <button type='button' className='btn btn-secondary' onClick={() => previousSection && setActiveSectionId(previousSection.id)} disabled={!previousSection}>
              Previous Section
            </button>
            <button type='button' className='btn btn-secondary' onClick={() => nextSection && setActiveSectionId(nextSection.id)} disabled={!nextSection}>
              Next Section
            </button>
            <button type='button' className='btn btn-secondary' onClick={() => setRefreshNonce((value) => value + 1)} disabled={isLoading}>
              {isLoading ? 'Recalculating...' : 'Recalculate Workbook'}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className='compact-card info-banner'>
          <div>
            <p className='section-kicker'>Workbook Error</p>
            <h3>Unable to load the Excel-backed view</h3>
            <p className='muted-copy'>{error}</p>
          </div>
        </section>
      ) : null}

      {activeSection ? (
        <div className='fpa-workbook-content-grid'>
          <section className='compact-card fpa-subpanel fpa-workbook-shell'>
            <div className='step-header'>
              <div>
                <span className='step-badge'>Workbook Section</span>
                <h4>{activeSection.title}</h4>
                <p className='section-note'>Rows {activeSection.startRow}-{activeSection.endRow} from `{sheetName}` rendered in portal format without changing the workbook logic.</p>
              </div>
              <div className='fpa-tab-meta'>
                <span className='section-chip'>{activeSection.editableCellCount} editable cells</span>
                <span className='section-chip'>{activeSection.formulaCellCount} formulas</span>
                <span className='section-chip'>{displaySnapshot?.usedRange || 'Workbook range'}</span>
              </div>
            </div>

            <WorkbookSectionTable
              section={activeSection}
              draftInputs={draftInputs}
              canEdit={canEdit}
              isBusy={isBusy}
              selectedAddress={selectedCellAddress}
              onSelectCell={(cell) => setSelectedCellAddress(cell.address)}
              onDraftChange={handleDraftChange}
              onDraftCommit={handleDraftCommit}
            />
          </section>

          <aside className='compact-card fpa-subpanel fpa-workbook-inspector'>
            <div className='step-header'>
              <div>
                <span className='step-badge'>Cell Inspector</span>
                <h4>{selectedCell?.address || 'Select a cell'}</h4>
                <p className='section-note'>Review the displayed workbook value, exact Excel formula, and editability for the selected cell.</p>
              </div>
            </div>

            <div className='summary-list'>
              <div className='summary-item'>
                <span className='summary-label'>Cell Type</span>
                <span className='summary-value'>{workbookCellKind(selectedCell)}</span>
              </div>
              <div className='summary-item'>
                <span className='summary-label'>Displayed Value</span>
                <span className='summary-value'>{selectedCellValue || '—'}</span>
              </div>
              <div className='summary-item'>
                <span className='summary-label'>Editable</span>
                <span className='summary-value'>{selectedCell?.isInput ? 'Yes' : 'No'}</span>
              </div>
              <div className='summary-item'>
                <span className='summary-label'>Formula</span>
                <span className='summary-value is-muted'>{selectedCell?.formula || '—'}</span>
              </div>
            </div>
          </aside>
        </div>
      ) : !isLoading && !error ? (
        <section className='compact-card info-banner'>
          <div>
            <p className='section-kicker'>Workbook Empty</p>
            <h3>No workbook rows were returned</h3>
            <p className='muted-copy'>This sheet did not return a used range from Excel. Recalculate the workbook or verify that the source workbook contains content on this tab.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

