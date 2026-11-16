#include <bits/stdc++.h>
using namespace std;

// Return max over i < j of min(h[i], h[j]) * (j - i).
long long solve(const vector<int>& h) {
    // TODO: write your algorithm here
    return 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<int> nums(n);
    for (auto& x : nums) cin >> x;
    cout << solve(nums) << '\n';
    return 0;
}
