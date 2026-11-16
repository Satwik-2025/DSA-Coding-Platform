#include <bits/stdc++.h>
using namespace std;

// Return the number of pairs (i, j) with i < j and nums[i] > nums[j].
long long solve(const vector<int>& nums) {
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
