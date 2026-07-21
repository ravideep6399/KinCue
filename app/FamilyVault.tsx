"use client";

import { Download, FileText, LockKeyhole, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  getVaultDocumentUrl,
  removeVaultDocument,
  subscribeToVaultDocuments,
  uploadVaultDocument,
} from "../src/firebase/vault";
import type { VaultDocument, VaultDocumentCategory } from "../src/firebase/models";
import { useKinCueAuth } from "./FirebaseAuth";
import { useFamilySpace } from "./FamilySpace";
import { recordActivity } from "../src/firebase/activity";

export function FamilyVault({ notify }: { notify: (message: string) => void }) {
  const { getAccessToken, identity } = useKinCueAuth();
  const { activeSpace } = useFamilySpace();
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loadedSpaceId, setLoadedSpaceId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<VaultDocumentCategory>("other");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canContribute = activeSpace?.role !== "viewer";
  const canDelete = activeSpace?.role === "owner" || activeSpace?.role === "primary_caregiver";
  const loading = loadedSpaceId !== activeSpace?.familySpaceId;

  useEffect(() => {
    if (!activeSpace) return;
    const familySpaceId = activeSpace.familySpaceId;
    return subscribeToVaultDocuments(
      familySpaceId,
      (nextDocuments) => {
        setDocuments(nextDocuments);
        setLoadedSpaceId(familySpaceId);
        setError(null);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoadedSpaceId(familySpaceId);
      },
    );
  }, [activeSpace]);

  function openUpload() {
    setFile(null);
    setCategory("other");
    setDescription("");
    setError(null);
    setDialogOpen(true);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSpace || !identity || !file) return;
    setUploading(true);
    setError(null);
    try {
      const accessToken = await requireAccessToken(getAccessToken);
      await uploadVaultDocument(activeSpace.familySpaceId, accessToken, file, category, description);
      void recordActivity(activeSpace.familySpaceId, identity, "vault_uploaded", `Uploaded Vault file: ${file.name}`);
      setDialogOpen(false);
      notify("File uploaded to the family Vault.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The file could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function download(document: VaultDocument) {
    if (!activeSpace) return;
    try {
      const accessToken = await requireAccessToken(getAccessToken);
      const url = await getVaultDocumentUrl(activeSpace.familySpaceId, document.id, accessToken);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      notify(downloadError instanceof Error ? downloadError.message : "The file could not be opened.");
    }
  }

  async function remove(document: VaultDocument) {
    if (!activeSpace || !window.confirm(`Delete ${document.name} from the Vault?`)) return;
    try {
      const accessToken = await requireAccessToken(getAccessToken);
      await removeVaultDocument(activeSpace.familySpaceId, document.id, accessToken);
      if (identity) void recordActivity(activeSpace.familySpaceId, identity, "vault_deleted", `Deleted Vault file: ${document.name}`);
      notify("Vault file deleted.");
    } catch (deleteError) {
      notify(deleteError instanceof Error ? deleteError.message : "The file could not be deleted.");
    }
  }

  return (
    <section className="content">
      <div className="page-heading">
        <div><p className="eyebrow">Private family files</p><h2>Vault</h2><p>Documents and media available only to Family Space members.</p></div>
        {canContribute && <button className="primary-button" onClick={openUpload} type="button"><Plus size={17} /> Upload file</button>}
      </div>
      <div className="panel">
        <div className="panel-header"><h3>Family documents</h3><span className="inline-label"><LockKeyhole size={13} /> Private</span></div>
        {loading ? (
          <VaultEmpty title="Loading documents..." />
        ) : documents.length === 0 ? (
          <VaultEmpty title="No documents" />
        ) : (
          <div className="vault-table-wrap"><table className="vault-table"><thead><tr><th>Document</th><th>Category</th><th>Uploaded by</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td><span className="document-name"><FileText size={16} />{document.name}</span>{document.description && <small>{document.description}</small>}</td><td>{document.category}</td><td>{document.uploadedByDisplayName}<small>{formatSize(document.size)}</small></td><td><div className="table-actions"><button className="icon-button" onClick={() => void download(document)} title={`Open ${document.name}`} type="button"><Download size={16} /></button>{canDelete && <button className="icon-button danger-button" onClick={() => void remove(document)} title={`Delete ${document.name}`} type="button"><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table></div>
        )}
        {error && !dialogOpen && !loading && <p className="panel-error" role="alert">{error}</p>}
      </div>

      {dialogOpen && (
        <div className="modal-backdrop" onMouseDown={() => !uploading && setDialogOpen(false)} role="presentation">
          <section aria-labelledby="vault-dialog-title" aria-modal="true" className="member-dialog vault-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <header className="dialog-header"><div><p className="eyebrow">Private upload</p><h2 id="vault-dialog-title">Upload to Vault</h2></div><button className="icon-button" disabled={uploading} onClick={() => setDialogOpen(false)} title="Close" type="button"><X size={18} /></button></header>
            <form className="profile-form" onSubmit={upload}>
              <label htmlFor="vault-file">File</label><input accept="image/*,application/pdf,audio/*" id="vault-file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required type="file" />
              <label htmlFor="vault-category">Category</label><select id="vault-category" onChange={(event) => setCategory(event.target.value as VaultDocumentCategory)} value={category}><option value="care">Care</option><option value="identity">Identity</option><option value="household">Household</option><option value="insurance">Insurance</option><option value="other">Other</option></select>
              <label htmlFor="vault-description">Description</label><textarea id="vault-description" maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={4} value={description} />
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="form-actions"><button className="secondary-button" disabled={uploading} onClick={() => setDialogOpen(false)} type="button">Cancel</button><button className="primary-button" disabled={uploading || !file} type="submit"><Upload size={17} />{uploading ? "Uploading..." : "Upload file"}</button></div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function VaultEmpty({ title }: { title: string }) {
  return <div className="product-empty"><FileText size={28} /><h3>{title}</h3></div>;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function requireAccessToken(getAccessToken: () => Promise<string | null>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in again before accessing the Vault.");
  return token;
}
