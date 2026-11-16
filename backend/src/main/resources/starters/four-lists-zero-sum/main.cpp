#include <bits/stdc++.h>
using namespace std;

// Return how many index tuples (i, j, k, l) have a[i] + b[j] + c[k] + d[l] == 0.
long long solve(const vector<int>& a, const vector<int>& b, const vector<int>& c, const vector<int>& d) {
    // TODO: write your algorithm here
    return 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<vector<int>> lists(4, vector<int>(n));
    for (auto& list : lists)
        for (auto& x : list) cin >> x;
    cout << solve(lists[0], lists[1], lists[2], lists[3]) << '\n';
    return 0;
}
