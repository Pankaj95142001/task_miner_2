import { renderFpaWorkbookSheet } from '../api/deals';
import TowerWorkbookSheet from './TowerWorkbookSheet';

export default function FpaWorkbookSheet(props) {
  return (
    <TowerWorkbookSheet
      {...props}
      towerLabel='FP&A'
      workbookInputsBySheet={props.currentDeal?.fpaWorkbookInputs}
      renderWorkbookSheet={renderFpaWorkbookSheet}
    />
  );
}
