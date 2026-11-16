#include <bits/stdc++.h>
using namespace std;

// Return the shortest palindrome that ends with s (characters are only added in front).
string solve(const string& s) {
    // TODO: write your algorithm here
    return s;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string s;
    getline(cin, s);
    if (!s.empty() && s.back() == '\r') s.pop_back();
    // Brackets make an empty answer visible in the output.
    cout << "[" << solve(s) << "]" << '\n';
    return 0;
}
