function buildConflictResponse(push, existing) {
  const existingVersion = existing ? existing.version : 0;
  let conflictType = 'stale_base_version';

  if (!existing) {
    conflictType = 'remote_missing';
  } else if (existing.is_deleted === true) {
    conflictType = 'concurrent_delete';
  } else if (push.expected_base_version === 0 && existingVersion > 0) {
    conflictType = 'concurrent_edit';
  }

  return {
    error: `Conflict detected on item ${push.id}`,
    conflict_type: conflictType,
    item_id: push.id,
    your_base: push.expected_base_version,
    server_actual: existingVersion,
    server_is_deleted: existing?.is_deleted === true,
  };
}

module.exports = {
  buildConflictResponse,
};
