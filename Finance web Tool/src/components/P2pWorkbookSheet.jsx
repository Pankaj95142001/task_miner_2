import { renderP2pWorkbookSheet } from '../api/deals';
import TowerWorkbookSheet from './TowerWorkbookSheet';

export default function P2pWorkbookSheet(props) {
  return (
    <TowerWorkbookSheet
      {...props}
      towerLabel='P2P'
      workbookInputsBySheet={props.currentDeal?.p2pWorkbookInputs}
      renderWorkbookSheet={renderP2pWorkbookSheet}
    />
  );
}
