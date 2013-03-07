/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Cache actual visit_count value, filled by add_visit, used by check_results
let visit_count = 0;

function add_visit(aURI, aVisitDate, aVisitType) {
  let isRedirect = aVisitType == TRANSITION_REDIRECT_PERMANENT ||
                   aVisitType == TRANSITION_REDIRECT_TEMPORARY;
  let visitId = PlacesUtils.history.addVisit(aURI, aVisitDate, null,
                                             aVisitType, isRedirect, 0);

  // Increase visit_count if applicable
  if (aVisitType != 0 &&
      aVisitType != TRANSITION_EMBED &&
      aVisitType != TRANSITION_FRAMED_LINK &&
      aVisitType != TRANSITION_DOWNLOAD) {
    visit_count ++;
  }

  // Get the place id
  if (visitId > 0) {
    let sql = "SELECT place_id FROM moz_historyvisits WHERE id = ?1";
    let stmt = DBConn().createStatement(sql);
    stmt.bindByIndex(0, visitId);
    do_check_true(stmt.executeStep());
    let placeId = stmt.getInt64(0);
    stmt.finalize();
    do_check_true(placeId > 0);
    return placeId;
  }
  return 0;
}

/**
 * Checks for results consistency, using visit_count as constraint
 * @param   aExpectedCount
 *          Number of history results we are expecting (excluded hidden ones)
 * @param   aExpectedCountWithHidden
 *          Number of history results we are expecting (included hidden ones)
 */
function check_results(aExpectedCount, aExpectedCountWithHidden) {
  let query = PlacesUtils.history.getNewQuery();
  // used to check visit_count
  query.minVisits = visit_count;
  query.maxVisits = visit_count;
  let options = PlacesUtils.history.getNewQueryOptions();
  options.queryType = Ci.nsINavHistoryQueryOptions.QUERY_TYPE_HISTORY;
  let root = PlacesUtils.history.executeQuery(query, options).root;
  root.containerOpen = true;
  // Children without hidden ones
  do_check_eq(root.childCount, aExpectedCount);
  root.containerOpen = false;

  // Execute again with includeHidden = true
  // This will ensure visit_count is correct
  options.includeHidden = true;
  root = PlacesUtils.history.executeQuery(query, options).root;
  root.containerOpen = true;
  // Children with hidden ones
  do_check_eq(root.childCount, aExpectedCountWithHidden);
  root.containerOpen = false;
}

// main
function run_test() {
  const TEST_URI = uri("http://test.mozilla.org/");

  // Add a visit that force hidden
  add_visit(TEST_URI, Date.now()*1000, TRANSITION_EMBED);
  check_results(0, 0);

  let placeId = add_visit(TEST_URI, Date.now()*1000, TRANSITION_FRAMED_LINK);
  check_results(0, 1);

  // Add a visit that force unhide and check the place id.
  // - We expect that the place gets hidden = 0 while retaining the same
  //   place id and a correct visit_count.
  do_check_eq(add_visit(TEST_URI, Date.now()*1000, TRANSITION_TYPED), placeId);
  check_results(1, 1);

  // Add a visit, check that hidden is not overwritten
  // - We expect that the place has still hidden = 0, while retaining
  //   correct visit_count.
  add_visit(TEST_URI, Date.now()*1000, TRANSITION_EMBED);
  check_results(1, 1);
}
