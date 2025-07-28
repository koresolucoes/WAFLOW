import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { useUiStore } from '../../stores/uiStore';
import { ALERT_TRIANGLE_ICON } from '../icons';

const ConfirmationModal: React.FC = () => {
  const {
    isConfirmationOpen,
    confirmationTitle,
    confirmationMessage,
    onConfirmAction,
    hideConfirmation,
  } = useUiStore();

  const handleConfirm = () => {
    if (onConfirmAction) {
      onConfirmAction();
    }
    hideConfirmation();
  };

  if (!isConfirmationOpen) {
    return null;
  }

  return (
    <Modal isOpen={isConfirmationOpen} onClose={hideConfirmation} title={confirmationTitle}>
        <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <ALERT_TRIANGLE_ICON className="h-6 w-6 text-red-400" aria-hidden="true" />
            </div>
            <div className="mt-3 text-center sm:mt-5">
                <p className="text-base text-slate-300">
                    {confirmationMessage}
                </p>
            </div>
        </div>
        <div className="mt-5 sm:mt-6 flex justify-center gap-3">
            <Button
                type="button"
                variant="secondary"
                onClick={hideConfirmation}
            >
                Cancelar
            </Button>
            <Button
                type="button"
                variant="primary"
                onClick={handleConfirm}
                className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
            >
                Confirmar
            </Button>
        </div>
    </Modal>
  );
};

export default ConfirmationModal;
